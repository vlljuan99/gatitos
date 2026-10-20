import { PUBLIC_URL } from './config.js';

/**
 * Limitador sencillo en memoria por IP. Suficiente para un único contenedor:
 * frena bots y fuerza bruta sin depender de servicios externos.
 */
export function rateLimit({
  windowMs,
  max,
  onlyFailures = false,
  message = 'Demasiados intentos. Espera un poquito y vuelve a probar 🐾',
}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 10_000) {
      for (const [ip, entry] of hits) if (entry.reset <= now) hits.delete(ip);
    }
    let entry = hits.get(req.ip);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(req.ip, entry);
    }
    if (entry.count >= max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    entry.count += 1;
    // Con onlyFailures (login) solo cuentan los intentos fallidos: el equipo
    // puede entrar desde la misma wifi sin bloquearse entre sí.
    if (onlyFailures) {
      res.on('finish', () => {
        if (res.statusCode < 400) entry.count -= 1;
      });
    }
    next();
  };
}

const PUBLIC_HOST = new URL(PUBLIC_URL).host;

/**
 * Rechaza peticiones que modifican datos si vienen de otra web (CSRF). La
 * cookie de sesión ya es SameSite=Lax; esto es una segunda barrera.
 */
export function sameOriginOnly(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    return res.status(403).json({ error: 'Origen no permitido' });
  }
  if (host === req.get('host') || host === PUBLIC_HOST) return next();
  return res.status(403).json({ error: 'Origen no permitido' });
}

/**
 * Campo trampa: los formularios llevan un input oculto «website» que una
 * persona nunca rellena. Si llega con algo, fingimos éxito y no guardamos nada.
 */
export function isBot(body) {
  return typeof body?.website === 'string' && body.website.trim() !== '';
}
