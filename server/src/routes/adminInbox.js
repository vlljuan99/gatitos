import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { photosFor } from '../cats.js';
import { parseBody, parseId, requiredText } from '../validation.js';
import { setCatStatus } from './adminCats.js';

export const APPLICATION_STATUSES = ['nueva', 'entrevista', 'visita', 'aprobada', 'adoptado', 'descartada'];
const STATUS_LABELS = {
  nueva: 'Nueva',
  entrevista: 'Entrevista',
  visita: 'Visita',
  aprobada: 'Aprobada',
  adoptado: 'Adoptado',
  descartada: 'Descartada',
};

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function serializeApplication(row) {
  return {
    id: row.id,
    status: row.status,
    name: row.name,
    email: row.email,
    phone: row.phone,
    municipality: row.municipality,
    province: row.province,
    catId: row.cat_id,
    catName: row.cat_name,
    catSlug: row.cat_slug ?? null,
    notesCount: row.notes_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function countsBy(table, statuses) {
  const rows = db.prepare(`SELECT status, COUNT(*) AS n FROM ${table} GROUP BY status`).all();
  const counts = Object.fromEntries(statuses.map((s) => [s, 0]));
  for (const row of rows) counts[row.status] = row.n;
  return counts;
}

/** Solicitudes de adopción: tablero por etapas con notas internas. */
export function adminApplicationsRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    const status = APPLICATION_STATUSES.includes(req.query.estado) ? req.query.estado : null;
    const rows = db
      .prepare(
        `SELECT a.*, c.slug AS cat_slug,
           (SELECT COUNT(*) FROM application_notes n WHERE n.application_id = a.id) AS notes_count
         FROM applications a LEFT JOIN cats c ON c.id = a.cat_id
         ${status ? 'WHERE a.status = ?' : ''}
         ORDER BY a.created_at DESC, a.id DESC`,
      )
      .all(...(status ? [status] : []));
    res.json({ applications: rows.map(serializeApplication), counts: countsBy('applications', APPLICATION_STATUSES) });
  });

  function loadApplication(id) {
    const row = db
      .prepare('SELECT a.*, c.slug AS cat_slug FROM applications a LEFT JOIN cats c ON c.id = a.cat_id WHERE a.id = ?')
      .get(id);
    if (!row) return null;
    const cat = row.cat_id ? db.prepare('SELECT id, slug, name, status, sex FROM cats WHERE id = ?').get(row.cat_id) : null;
    const notes = db
      .prepare('SELECT id, author_name, body, created_at FROM application_notes WHERE application_id = ? ORDER BY id')
      .all(id)
      .map((n) => ({ id: n.id, author: n.author_name, body: n.body, createdAt: n.created_at }));
    return {
      ...serializeApplication(row),
      answers: parseJson(row.answers, {}),
      cat: cat ? { ...cat, photo: photosFor([cat.id]).get(cat.id)[0] ?? null } : null,
      notes,
    };
  }

  router.get('/:id', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const application = loadApplication(id);
    if (!application) return res.status(404).json({ error: 'No encontramos esta solicitud' });
    res.json({ application });
  });

  const statusSchema = z.object({
    status: z.enum(APPLICATION_STATUSES),
    // Opcional: al aprobar o cerrar una adopción, actualizar también la ficha del gatito.
    catStatus: z.enum(['reservado', 'adoptado', 'disponible']).optional(),
  });

  router.patch('/:id', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(statusSchema, req, res);
    if (!data) return;
    const current = db.prepare('SELECT status, cat_id FROM applications WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'No encontramos esta solicitud' });

    db.transaction(() => {
      if (current.status !== data.status) {
        db.prepare("UPDATE applications SET status = ?, updated_at = datetime('now') WHERE id = ?").run(data.status, id);
        db.prepare('INSERT INTO application_notes (application_id, user_id, author_name, body) VALUES (?, ?, ?, ?)').run(
          id,
          req.user.id,
          req.user.name,
          `Ha cambiado el estado: ${STATUS_LABELS[current.status]} → ${STATUS_LABELS[data.status]}`,
        );
      }
      if (data.catStatus && current.cat_id) setCatStatus(current.cat_id, data.catStatus);
    })();
    res.json({ application: loadApplication(id) });
  });

  router.post('/:id/notas', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(z.object({ body: requiredText(3000, 'Escribe la nota') }), req, res);
    if (!data) return;
    if (!db.prepare('SELECT 1 FROM applications WHERE id = ?').get(id)) {
      return res.status(404).json({ error: 'No encontramos esta solicitud' });
    }
    db.prepare('INSERT INTO application_notes (application_id, user_id, author_name, body) VALUES (?, ?, ?, ?)').run(
      id,
      req.user.id,
      req.user.name,
      data.body,
    );
    db.prepare("UPDATE applications SET updated_at = datetime('now') WHERE id = ?").run(id);
    res.status(201).json({ application: loadApplication(id) });
  });

  router.delete('/:id', requireAdmin, (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const info = db.prepare('DELETE FROM applications WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos esta solicitud' });
    res.json({ ok: true });
  });

  return router;
}

/**
 * Bandejas sencillas (mensajes de contacto y ofertas de voluntariado): listar,
 * cambiar el estado y borrar. Comparten forma, cambia la tabla y los campos.
 */
function inboxRouter({ table, statuses, serialize }) {
  const router = Router();

  router.get('/', (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY created_at DESC, id DESC`).all();
    res.json({ items: rows.map(serialize), counts: countsBy(table, statuses) });
  });

  router.patch('/:id', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(z.object({ status: z.enum(statuses) }), req, res);
    if (!data) return;
    const info = db
      .prepare(`UPDATE ${table} SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(data.status, id);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ item: serialize(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id)) });
  });

  router.delete('/:id', requireAdmin, (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
  });

  return router;
}

export const MESSAGE_STATUSES = ['nuevo', 'leido', 'archivado'];
export const VOLUNTEER_STATUSES = ['nuevo', 'contactado', 'archivado'];

export const adminMessagesRouter = () =>
  inboxRouter({
    table: 'messages',
    statuses: MESSAGE_STATUSES,
    serialize: (row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      subject: row.subject,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
    }),
  });

export const adminVolunteersRouter = () =>
  inboxRouter({
    table: 'volunteers',
    statuses: VOLUNTEER_STATUSES,
    serialize: (row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      municipality: row.municipality,
      areas: parseJson(row.areas, []),
      availability: row.availability,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    }),
  });
