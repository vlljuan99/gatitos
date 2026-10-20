import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { parseBody, parseId, requiredText, text } from '../validation.js';

// Casas de acogida: personas voluntarias que cuidan gatos en su casa hasta
// que encuentran familia. Sus datos (DNI y dirección incluidos) van al
// acuerdo de acogida, así que solo los ve el equipo. Borrar es cosa de un
// bigote mayor; para dejar de usar una casa basta con marcarla inactiva.

export function serializeFoster(row, cats = []) {
  return {
    id: row.id,
    name: row.name,
    dni: row.dni,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    active: Boolean(row.active),
    cats,
    createdAt: row.created_at,
  };
}

const fosterSchema = z.object({
  name: requiredText(120, 'Escribe su nombre y apellidos'),
  dni: text(20).default(''),
  phone: text(30).default(''),
  email: z.union([z.literal(''), z.email('Escribe un email válido')]).default(''),
  address: text(300).default(''),
  notes: text(2000).default(''),
  active: z.boolean().default(true),
});

function catsByFoster() {
  const rows = db
    .prepare(
      `SELECT id, name, sex, status, file_number, foster_id, foster_since FROM cats
       WHERE foster_id IS NOT NULL AND status NOT IN ('adoptado', 'colonia') ORDER BY foster_since, name`,
    )
    .all();
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.foster_id)) map.set(row.foster_id, []);
    map.get(row.foster_id).push({
      id: row.id,
      name: row.name,
      sex: row.sex,
      status: row.status,
      fileNumber: row.file_number ?? '',
      since: row.foster_since ?? '',
    });
  }
  return map;
}

export function loadFoster(id) {
  const row = db.prepare('SELECT * FROM fosters WHERE id = ?').get(id);
  return row ? serializeFoster(row, catsByFoster().get(id) ?? []) : null;
}

export function adminFostersRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    const cats = catsByFoster();
    const rows = db.prepare('SELECT * FROM fosters ORDER BY active DESC, name COLLATE NOCASE').all();
    res.json({ fosters: rows.map((row) => serializeFoster(row, cats.get(row.id) ?? [])) });
  });

  router.get('/:id', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const foster = loadFoster(id);
    if (!foster) return res.status(404).json({ error: 'No encontramos esta casa de acogida' });
    res.json({ foster });
  });

  router.post('/', (req, res) => {
    const data = parseBody(fosterSchema, req, res);
    if (!data) return;
    const info = db
      .prepare(
        `INSERT INTO fosters (name, dni, phone, email, address, notes, active)
         VALUES (@name, @dni, @phone, @email, @address, @notes, @active)`,
      )
      .run({ ...data, active: data.active ? 1 : 0 });
    res.status(201).json({ foster: loadFoster(info.lastInsertRowid) });
  });

  router.put('/:id', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(fosterSchema, req, res);
    if (!data) return;
    const info = db
      .prepare(
        `UPDATE fosters SET name = @name, dni = @dni, phone = @phone, email = @email, address = @address,
           notes = @notes, active = @active, updated_at = datetime('now')
         WHERE id = @id`,
      )
      .run({ ...data, active: data.active ? 1 : 0, id });
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos esta casa de acogida' });
    res.json({ foster: loadFoster(id) });
  });

  // Al borrarla, sus gatos se quedan sin casa de acogida asignada (no se borran).
  router.delete('/:id', requireAdmin, (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const info = db.transaction(() => {
      db.prepare('UPDATE cats SET foster_since = NULL WHERE foster_id = ?').run(id);
      return db.prepare('DELETE FROM fosters WHERE id = ?').run(id);
    })();
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos esta casa de acogida' });
    res.json({ ok: true });
  });

  return router;
}
