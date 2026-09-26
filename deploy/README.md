# Operación de producción de Bigotes

Bigotes vive en el VPS Hetzner compartido (el mismo que tilestudio, tri-dnd,
teacherflow y friendlyflights), detrás del Caddy de `/opt/tilestudio`, en
`https://bigotes.167-233-99-156.sslip.io`.

Cada despliegue construye una imagen Docker inmutable `bigotes:<commit-sha>`.
El fichero `/opt/bigotes/.deploy.env` registra qué imagen ejecuta Compose y
`/api/health` confirma la revisión desplegada y la migración de SQLite.

## Primer despliegue (una sola vez)

1. En el servidor, crea la carpeta y el fichero de entorno:

   ```bash
   ssh root@167.233.99.156
   mkdir -p /opt/bigotes && cd /opt/bigotes
   nano app.env        # copia deploy/app.env.example y rellénalo
   chmod 600 app.env
   ```

   Rellena como mínimo `PUBLIC_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y
   `ADMIN_NAME`: al arrancar sin nadie en el equipo se crea esa cuenta de
   administración. Después puedes quitar la contraseña de `app.env` y
   cambiarla desde «Mi cuenta» en el panel.

2. Comprueba que el `Caddyfile` de tilestudio importa los sitios sueltos
   (`import sites/*.caddy`), igual que para tri-dnd.

3. En GitHub, el repositorio necesita el secreto `HETZNER_SSH_KEY` (la misma
   clave que usan los otros proyectos del VPS).

4. Lanza el workflow **Deploy to Hetzner** a mano desde la pestaña Actions.

5. Opcional: carga los gatitos de demostración para enseñar la web a la
   asociación (se pueden borrar después desde el panel):

   ```bash
   docker exec -w /app/server bigotes-app npm run seed:demo
   ```

Si prefieres crear la administración a mano en vez de con `app.env`:

```bash
docker exec -w /app/server bigotes-app npm run create-user -- --email ana@ejemplo.es --name Ana --role admin
```

## Despliegue normal

El workflow manual `Deploy to Hetzner` es la única vía normal:

1. Instala exactamente los `package-lock.json` con `npm ci`.
2. Ejecuta las pruebas unitarias, el build de Vite, las pruebas E2E en móvil y
   `npm audit` de producción.
3. Construye `bigotes:<sha>` en el VPS con metadatos OCI.
4. Antes de reiniciar, crea un backup online e íntegro de SQLite y archiva las
   fotos y el secreto de sesión.
5. Levanta la imagen por SHA, recarga Caddy y comprueba web, SQLite, SHA y
   las etiquetas para compartir.
6. Si la comprobación falla, vuelve automáticamente a la imagen anterior. El
   job queda en rojo para que el incidente se vea.

Los backups viven en `/opt/bigotes/backups/<fecha>-<sha-corto>/`:

- `bigotes.db`, copiado con la API online de SQLite y validado con
  `PRAGMA integrity_check`;
- `files.tar.gz`, con las fotos (`uploads/`) y el secreto de sesión;
- `SHA256SUMS`, para verificar ambos.

No hay borrado automático de backups ni de imágenes. **Las fotos son lo más
valioso**: conviene copiar `/opt/bigotes/backups` fuera del VPS (por ejemplo,
a una Storage Box de Hetzner) antes de decidir una retención.

## Rollback del código

```bash
cd /opt/bigotes
./rollback.sh              # a la imagen anterior
./rollback.sh <commit-sha> # a una revisión concreta que siga en Docker
```

Las migraciones son incrementales y no se revierten al cambiar de imagen. Si el
problema ha alterado datos, hay que restaurar también el backup.

## Restauración manual de datos

Destructiva: con la aplicación parada y guardando antes el estado fallido.

```bash
cd /opt/bigotes
BACKUP_ID=<fecha-sha-del-directorio>
test -f "backups/$BACKUP_ID/bigotes.db"
(cd "backups/$BACKUP_ID" && sha256sum -c SHA256SUMS)
docker compose --env-file .deploy.env stop app
cp -a data "backups/estado-fallido-$(date -u +%Y%m%dT%H%M%SZ)"
cp "backups/$BACKUP_ID/bigotes.db" data/bigotes.db
rm -f data/bigotes.db-wal data/bigotes.db-shm
test ! -f "backups/$BACKUP_ID/files.tar.gz" || tar -xzf "backups/$BACKUP_ID/files.tar.gz" -C data
chown -R 1000:1000 data
docker compose --env-file .deploy.env up -d app
curl --fail https://bigotes.167-233-99-156.sslip.io/api/health
```

## Dominio propio (cuando lo haya)

1. Apunta el dominio (registro A) a `167.233.99.156`.
2. Cambia la primera línea de `deploy/bigotes.caddy` por el dominio (se pueden
   dejar los dos separados por comas mientras tanto) y `PUBLIC_URL` en
   `/opt/bigotes/app.env`.
3. Actualiza `APP_URL` en `.github/workflows/deploy.yml` y `monitor.yml` y
   vuelve a desplegar. Caddy saca el certificado solo.

## Avisos por email

Opcionales. Hetzner bloquea el SMTP saliente (puertos 25 y 465), así que se usa
la API HTTPS de [Resend](https://resend.com): rellena `RESEND_API_KEY`,
`MAIL_FROM` (un remitente de un dominio verificado en Resend) y `NOTIFY_EMAIL`
en `app.env` y reinicia (`docker compose --env-file .deploy.env up -d app`).
Sin ellos no se envía nada y todo queda igualmente en el panel.

## Monitor

`Monitor production` consulta cada 30 minutos la portada y `/api/health`. Un
fallo queda como ejecución fallida en GitHub Actions.
