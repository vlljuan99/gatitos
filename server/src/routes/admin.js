import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { CONTENT, getAllContent, saveContent } from '../content.js';
import { serializeCats } from '../cats.js';
import { parseBody } from '../validation.js';
import { adminCatsRouter } from './adminCats.js';
import { adminApplicationsRouter, adminMessagesRouter, adminVolunteersRouter } from './adminInbox.js';
import { adminTeamRouter } from './adminTeam.js';

// Todo lo de /api/admin exige sesión del equipo. Lo exclusivo de la
// administración (equipo, datos legales, borrar) lo marca requireAdmin.
export function adminRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/resumen', (req, res) => {
    const count = (sql) => db.prepare(sql).get().n;
    const cats = Object.fromEntries(
      db
        .prepare('SELECT status, COUNT(*) AS n FROM cats GROUP BY status')
        .all()
        .map((r) => [r.status, r.n]),
    );
    const available = (order) =>
      serializeCats(db.prepare(`SELECT * FROM cats WHERE status = 'disponible' ORDER BY ${order} LIMIT 4`).all(), {
        admin: true,
      });
    res.json({
      applications: {
        new: count("SELECT COUNT(*) AS n FROM applications WHERE status = 'nueva'"),
        open: count("SELECT COUNT(*) AS n FROM applications WHERE status IN ('nueva', 'entrevista', 'visita', 'aprobada')"),
      },
      messages: { new: count("SELECT COUNT(*) AS n FROM messages WHERE status = 'nuevo'") },
      volunteers: { new: count("SELECT COUNT(*) AS n FROM volunteers WHERE status = 'nuevo'") },
      cats: {
        borrador: cats.borrador ?? 0,
        disponible: cats.disponible ?? 0,
        reservado: cats.reservado ?? 0,
        adoptado: cats.adoptado ?? 0,
      },
      // Los más queridos en el match y los que necesitan un empujón.
      mostLoved: available('likes DESC, created_at DESC'),
      needLove: available('likes ASC, COALESCE(arrived_at, created_at) ASC'),
    });
  });

  router.get('/contenidos', (req, res) => {
    const adminOnly = Object.entries(CONTENT)
      .filter(([, entry]) => entry.adminOnly)
      .map(([key]) => key);
    res.json({ content: getAllContent(), adminOnly });
  });

  router.put('/contenidos/:key', (req, res, next) => {
    const entry = CONTENT[req.params.key];
    if (!entry) return res.status(404).json({ error: 'Sección desconocida' });
    if (entry.adminOnly) return requireAdmin(req, res, next);
    next();
  }, (req, res) => {
    const entry = CONTENT[req.params.key];
    const data = parseBody(entry.schema, req, res);
    if (!data) return;
    res.json({ value: saveContent(req.params.key, data) });
  });

  router.use('/gatitos', adminCatsRouter());
  router.use('/solicitudes', adminApplicationsRouter());
  router.use('/mensajes', adminMessagesRouter());
  router.use('/voluntariado', adminVolunteersRouter());
  router.use('/equipo', requireAdmin, adminTeamRouter());

  return router;
}
