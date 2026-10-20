import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { db } from './db.js';
import { APP_VERSION, BUILD_TIME, DATA_DIR, GIT_SHA, PUBLIC_URL, UPLOADS_DIR } from './config.js';
import { authRouter } from './auth.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { papersRouter } from './papers/router.js';
import { injectHead, metaFor, robotsTxt, sitemapXml } from './og.js';
import { sameOriginOnly } from './security.js';
import { videoSupport } from './videos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

export function createApp({ clientDist = DEFAULT_CLIENT_DIST } = {}) {
  const app = express();
  const https = PUBLIC_URL.startsWith('https://');

  // Detrás de Caddy: la IP real llega en X-Forwarded-For (limitadores por IP).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          mediaSrc: ["'self'", 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          manifestSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          ...(https ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      strictTransportSecurity: https,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      // Los nombres de fotos y vídeos son aleatorios y nunca se reescriben.
      immutable: true,
      maxAge: '365d',
      fallthrough: false,
    }),
  );

  app.get('/api/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      db.prepare('SELECT 1').get();
      fs.accessSync(DATA_DIR, fs.constants.R_OK | fs.constants.W_OK);
      res.json({
        ok: true,
        app: 'Bigotes',
        version: APP_VERSION,
        commit: GIT_SHA,
        builtAt: BUILD_TIME,
        database: { ok: true, migration: db.pragma('user_version', { simple: true }), storageWritable: true },
        videos: videoSupport(),
      });
    } catch (error) {
      console.error('[health] La comprobación ha fallado:', error);
      res.status(503).json({ ok: false, app: 'Bigotes', version: APP_VERSION, commit: GIT_SHA, database: { ok: false } });
    }
  });

  app.use('/api', sameOriginOnly);
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/auth', authRouter());
  app.use('/api/admin', adminRouter());
  app.use('/api/papeles', papersRouter());
  app.use('/api', publicRouter());
  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  app.get('/robots.txt', (req, res) => res.type('text/plain').send(robotsTxt()));
  app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(sitemapXml()));

  // En producción, el mismo Express sirve el build del cliente: un contenedor,
  // un puerto detrás de Caddy. Cada ruta de la SPA recibe su <head> con Open Graph.
  const indexFile = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexFile)) {
    const template = fs.readFileSync(indexFile, 'utf8');
    app.use(
      '/assets',
      express.static(path.join(clientDist, 'assets'), { immutable: true, maxAge: '365d', fallthrough: false }),
    );
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/.*/, (req, res) => {
      const { status, meta } = metaFor(req.path);
      res.status(status).set('Cache-Control', 'no-cache').type('html').send(injectHead(template, req.path, meta));
    });
  }

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Petición no válida' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Demasiados datos de una vez' });
    if (error.status === 404 || error.statusCode === 404) return res.status(404).json({ error: 'No encontrado' });
    console.error('[error]', error);
    res.status(500).json({ error: 'Algo ha salido mal. Vuelve a intentarlo en un momento.' });
  });

  return app;
}
