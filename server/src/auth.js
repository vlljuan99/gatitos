import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from './db.js';
import { COOKIE_NAME, IS_PROD, JWT_SECRET, SESSION_DAYS } from './config.js';
import { rateLimit } from './security.js';
import { email, parseBody } from './validation.js';

// Dos papeles en el equipo: una persona de administración (lo puede todo,
// incluido gestionar el equipo y los datos legales) y las «cuidabigotes»,
// que llevan el día a día: gatitos, solicitudes, mensajes y textos.
export const ROLES = {
  admin: 'Administración',
  cuidabigotes: 'Cuidabigotes',
};

export const MIN_PASSWORD = 8;

export function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    roleLabel: ROLES[row.role],
    active: Boolean(row.active),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

/** Contraseña temporal legible para dar de alta o restablecer (p. ej. «gato-7k2m-bigote»). */
export function temporaryPassword() {
  const words = ['gato', 'bigote', 'ronroneo', 'maullido', 'zarpa', 'ovillo', 'mimo', 'siesta'];
  const pick = () => words[crypto.randomInt(words.length)];
  const chunk = crypto.randomBytes(3).toString('hex');
  return `${pick()}-${chunk}-${pick()}`;
}

export function createUser({ email: address, name, role, password }) {
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)')
    .run(address.trim().toLowerCase(), name.trim(), role, hash);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function setSessionCookie(res, user) {
  // session_version va dentro del token: al cambiar la contraseña o desactivar
  // a alguien se incrementa y todas sus sesiones abiertas dejan de valer.
  const token = jwt.sign({ sub: user.id, v: user.session_version }, JWT_SECRET, {
    expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

/** Usuario de la cookie de sesión, o null si no hay sesión válida. */
function sessionUser(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!row || !row.active || row.session_version !== payload.v) return null;
    return publicUser(row);
  } catch {
    return null;
  }
}

/** Middleware: exige sesión válida de alguien del equipo y deja el usuario en req.user. */
export function requireAuth(req, res, next) {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'Tu sesión ha caducado. Vuelve a entrar.' });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo la administración puede hacer esto' });
  }
  next();
}

export function authRouter() {
  const router = Router();
  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, onlyFailures: true });

  const loginSchema = z.object({
    email: email(),
    password: z.string().min(1, 'Escribe tu contraseña').max(200),
  });

  router.post('/login', loginLimit, async (req, res) => {
    const data = parseBody(loginSchema, req, res);
    if (!data) return;
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email);
    const ok = row && row.active && (await bcrypt.compare(data.password, row.password_hash));
    if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(row.id);
    setSessionCookie(res, row);
    res.json({ user: publicUser(row) });
  });

  router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  // Sin sesión responde { user: null } (no es un error: el panel enseña el login).
  router.get('/me', (req, res) => {
    res.json({ user: sessionUser(req) });
  });

  const passwordSchema = z.object({
    current: z.string().min(1, 'Escribe tu contraseña actual'),
    next: z.string().min(MIN_PASSWORD, `La nueva contraseña necesita al menos ${MIN_PASSWORD} caracteres`).max(200),
  });

  router.put('/password', requireAuth, loginLimit, async (req, res) => {
    const data = parseBody(passwordSchema, req, res);
    if (!data) return;
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!(await bcrypt.compare(data.current, row.password_hash))) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta', fields: { current: 'No coincide' } });
    }
    db.prepare('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?').run(
      await hashPassword(data.next),
      row.id,
    );
    // La sesión actual se renueva para no echar a quien acaba de cambiarla.
    setSessionCookie(res, db.prepare('SELECT * FROM users WHERE id = ?').get(row.id));
    res.json({ ok: true });
  });

  return router;
}
