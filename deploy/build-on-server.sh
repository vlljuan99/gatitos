#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Construye una imagen inmutable, respalda los datos y recrea el contenedor.
# Se ejecuta EN el servidor y espera estar en /opt/bigotes/.
#
# Variables que entrega el workflow:
#   BIGOTES_IMAGE_TAG   etiqueta inmutable (normalmente el SHA completo)
#   BIGOTES_GIT_SHA     revisión mostrada por /api/health
#   BIGOTES_APP_VERSION versión de package.json
#   BIGOTES_BUILD_TIME  fecha ISO-8601 UTC
# ----------------------------------------------------------------------------
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SOURCE_ARCHIVE="$SCRIPT_DIR/src.tar.gz"
SOURCE_DIR="$SCRIPT_DIR/src"
DATA_DIR="$SCRIPT_DIR/data"
BACKUP_ROOT="$SCRIPT_DIR/backups"
DEPLOY_ENV="$SCRIPT_DIR/.deploy.env"
PREVIOUS_ENV="$SCRIPT_DIR/.deploy.previous.env"
ROLLBACK_NEEDED=0

rollback_on_error() {
  local status=$?
  trap - ERR
  if [[ "$ROLLBACK_NEEDED" == "1" && -f "$PREVIOUS_ENV" ]]; then
    echo "El contenedor nuevo no quedó sano; restaurando la imagen anterior"
    cp -- "$PREVIOUS_ENV" "$DEPLOY_ENV"
    docker compose --env-file "$DEPLOY_ENV" up -d --remove-orphans app || true
  fi
  exit "$status"
}
trap rollback_on_error ERR

[[ -f "$SCRIPT_DIR/app.env" ]] || {
  echo "Falta $SCRIPT_DIR/app.env: cópialo de deploy/app.env.example y rellénalo (ver deploy/README.md)"
  exit 1
}
[[ -f "$SOURCE_ARCHIVE" ]] || { echo "Falta $SOURCE_ARCHIVE"; exit 1; }
[[ "$SOURCE_DIR" == "$SCRIPT_DIR/src" && "$SOURCE_DIR" != "/src" ]] || {
  echo "Ruta de fuentes inesperada: $SOURCE_DIR"
  exit 1
}

IMAGE_TAG="${BIGOTES_IMAGE_TAG:-manual-$(date -u +%Y%m%d%H%M%S)}"
GIT_SHA="${BIGOTES_GIT_SHA:-desconocido}"
APP_VERSION="${BIGOTES_APP_VERSION:-0.1.0-dev}"
BUILD_TIME="${BIGOTES_BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
[[ "$IMAGE_TAG" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo "Etiqueta de imagen no válida"; exit 1; }
IMAGE="bigotes:$IMAGE_TAG"

# El directorio es fijo y se valida arriba antes de sustituirlo.
rm -rf -- "$SOURCE_DIR"
mkdir -p "$SOURCE_DIR"
tar -xzf "$SOURCE_ARCHIVE" -C "$SOURCE_DIR"

docker build \
  --build-arg "APP_VERSION=$APP_VERSION" \
  --build-arg "GIT_SHA=$GIT_SHA" \
  --build-arg "BUILD_TIME=$BUILD_TIME" \
  --label "org.opencontainers.image.source-revision=$GIT_SHA" \
  -t "$IMAGE" \
  "$SOURCE_DIR"

# La app corre sin privilegios (usuario node, uid 1000) y escribe en el volumen.
mkdir -p "$DATA_DIR"
chown -R 1000:1000 "$DATA_DIR"

# Copia consistente de SQLite mediante la API online de better-sqlite3. Las
# fotos y los vídeos se guardan aparte; nunca se copia el .db junto al WAL.
if docker container inspect bigotes-app >/dev/null 2>&1; then
  BACKUP_ID="$(date -u +%Y%m%dT%H%M%SZ)-${GIT_SHA:0:12}"
  BACKUP_DIR="$BACKUP_ROOT/$BACKUP_ID"
  TEMP_DB_NAME=".predeploy-$BACKUP_ID.db"
  TEMP_DB_HOST="$DATA_DIR/$TEMP_DB_NAME"
  mkdir -p "$BACKUP_DIR"

  docker exec -e "BACKUP_TARGET=/app/server/data/$TEMP_DB_NAME" bigotes-app \
    node --input-type=module -e '
      import Database from "better-sqlite3";
      const source = new Database("/app/server/data/bigotes.db");
      await source.backup(process.env.BACKUP_TARGET);
      source.close();
      const backup = new Database(process.env.BACKUP_TARGET, { readonly: true });
      const integrity = backup.pragma("integrity_check", { simple: true });
      backup.close();
      if (integrity !== "ok") throw new Error(`Backup SQLite inválido: ${integrity}`);
    '
  mv -- "$TEMP_DB_HOST" "$BACKUP_DIR/bigotes.db"

  # Fotos y vídeos nunca se reescriben (nombres aleatorios; la app solo crea y
  # borra), así que una copia con enlaces duros guarda el estado completo sin
  # ocupar más disco por cada despliegue. Un tar de todos los vídeos en cada
  # despliegue acabaría llenando el disco compartido del VPS.
  if [[ -d "$DATA_DIR/uploads" ]]; then
    cp -al -- "$DATA_DIR/uploads" "$BACKUP_DIR/uploads"
  fi
  if [[ -e "$DATA_DIR/jwt-secret.txt" ]]; then
    tar -czf "$BACKUP_DIR/files.tar.gz" -C "$DATA_DIR" jwt-secret.txt
  fi
  (cd "$BACKUP_DIR" && find . -maxdepth 1 -type f ! -name SHA256SUMS -printf '%P\0' | sort -z | xargs -0 -r sha256sum) \
    > "$BACKUP_DIR/SHA256SUMS"
  printf '%s\n' "$BACKUP_ID" > "$SCRIPT_DIR/.last-backup"
  echo "Backup previo verificado: $BACKUP_DIR"
else
  echo "Primer despliegue: no existe un contenedor anterior que respaldar"
fi

if [[ -f "$DEPLOY_ENV" ]]; then
  cp -- "$DEPLOY_ENV" "$PREVIOUS_ENV"
fi
printf 'BIGOTES_IMAGE=%s\n' "$IMAGE" > "$DEPLOY_ENV.tmp"
mv -- "$DEPLOY_ENV.tmp" "$DEPLOY_ENV"

ROLLBACK_NEEDED=1
docker compose --env-file "$DEPLOY_ENV" up -d --remove-orphans app

READY=0
for attempt in $(seq 1 6); do
  if docker exec -e "EXPECTED_SHA=$GIT_SHA" bigotes-app node -e '
    fetch("http://127.0.0.1:4000/api/health")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.ok || !body.database?.ok || body.commit !== process.env.EXPECTED_SHA) process.exit(1);
      })
      .catch(() => process.exit(1));
  '; then
    READY=1
    break
  fi
  sleep 5
done
[[ "$READY" == "1" ]]
ROLLBACK_NEEDED=0

echo "OK Bigotes actualizado: $IMAGE ($GIT_SHA)"
