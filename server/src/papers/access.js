import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { JWT_SECRET } from '../config.js';
import { publicUser, sessionUser } from '../auth.js';

// Los PDF se abren fuera del panel (pestaña nueva, visor del móvil, gestor de
// descargas de Android, la app instalada en el iPhone…), y ahí no siempre
// viaja la cookie de sesión. Por eso el panel pide un permiso de media hora
// y lo añade a los enlaces (?t=…). Solo sirve para leer papeles, caduca solo
// y deja de valer si la persona cambia de contraseña o la desactivan.

const PURPOSE = 'papeles';
const MINUTES = 30;

export function pdfToken(user) {
  const row = db.prepare('SELECT session_version FROM users WHERE id = ?').get(user.id);
  const token = jwt.sign({ sub: user.id, v: row.session_version, p: PURPOSE }, JWT_SECRET, { expiresIn: `${MINUTES}m` });
  return { token, expiresAt: new Date(Date.now() + MINUTES * 60 * 1000).toISOString() };
}

function tokenUser(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.p !== PURPOSE) return null;
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!row || !row.active || row.session_version !== payload.v) return null;
    return publicUser(row);
  } catch {
    return null;
  }
}

const EXPIRED_PAGE = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Enlace caducado · Bigotes</title>
<body style="font-family:system-ui,sans-serif;background:#faf6f3;color:#2b2727;display:grid;place-items:center;min-height:100vh;margin:0;padding:1rem;text-align:center">
<div><p style="font-size:3rem;margin:0">🐾</p><h1 style="font-size:1.4rem">Este enlace ha caducado</h1>
<p>Vuelve al panel de Bigotes y abre el papel otra vez.</p><p><a href="/admin" style="color:#735852;font-weight:700">Ir al panel</a></p></div></body></html>`;

/** Middleware: sesión del panel o permiso ?t= válido. */
export function requirePapersAuth(req, res, next) {
  const user = tokenUser(req.query.t) ?? sessionUser(req);
  if (!user) return res.status(401).type('html').send(EXPIRED_PAGE);
  req.user = user;
  next();
}
