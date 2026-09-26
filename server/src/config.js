import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const NODE_ENV = process.env.NODE_ENV ?? 'development';
export const IS_PROD = NODE_ENV === 'production';
export const PORT = Number(process.env.PORT) || 4000;

// Todo lo persistente (SQLite, fotos, secreto de sesión) vive en DATA_DIR,
// que en producción es el volumen montado en /app/server/data.
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(__dirname, '../data'));
export const DB_PATH = path.join(DATA_DIR, 'bigotes.db');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const CAT_PHOTOS_DIR = path.join(UPLOADS_DIR, 'gatitos');

fs.mkdirSync(CAT_PHOTOS_DIR, { recursive: true });

// URL pública absoluta: la usan las etiquetas Open Graph (WhatsApp, Instagram…)
// y el sitemap, que necesitan direcciones completas.
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/+$/, '');

export const APP_VERSION = process.env.APP_VERSION ?? '0.1.0-dev';
export const GIT_SHA = process.env.GIT_SHA ?? 'desconocido';
export const BUILD_TIME = process.env.BUILD_TIME ?? null;

export const COOKIE_NAME = 'bigotes_sesion';
export const SESSION_DAYS = 30;

// Si no llega JWT_SECRET por entorno, se genera uno y se guarda en el volumen
// para que las sesiones sobrevivan a los reinicios del contenedor.
function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, 'jwt-secret.txt');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}
export const JWT_SECRET = loadJwtSecret();

// Avisos por email (opcionales). Hetzner Cloud bloquea el SMTP saliente en los
// puertos 25 y 465, así que se usa la API HTTPS de Resend. Sin clave, no se envía nada.
export const MAIL = {
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  from: process.env.MAIL_FROM ?? '',
  notifyTo: process.env.NOTIFY_EMAIL ?? '',
};

// Meses que se guardan las solicitudes descartadas y los mensajes archivados
// antes de borrarlos automáticamente (política de privacidad).
export const RETENTION_MONTHS = Number(process.env.RETENTION_MONTHS) || 12;
