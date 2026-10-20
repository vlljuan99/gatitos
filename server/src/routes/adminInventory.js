import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { today } from '../numbers.js';
import { decimal, optionalDay, parseBody, parseId, requiredText, text } from '../validation.js';

// Inventario de la asociación en dos listas: medicación (con caducidad e
// instrucciones) e inventario general (comida, arena, transportines…). Las
// categorías deben coincidir con client/src/admin/Inventory.jsx.

export const INVENTORY_KINDS = ['medicacion', 'general'];
export const INVENTORY_CATEGORIES = {
  comida: 'Comida',
  arena: 'Arena',
  higiene: 'Higiene y limpieza',
  veterinario: 'Material veterinario',
  transporte: 'Transportines y jaulas',
  trampas: 'Trampas',
  descanso: 'Camas y mantas',
  juguetes: 'Juguetes y rascadores',
  otros: 'Otros',
};
/** Días antes de caducar en que la medicación sale como «caduca pronto». */
export const EXPIRY_WARNING_DAYS = 30;

export function serializeItem(row) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    minQuantity: row.min_quantity,
    expiresOn: row.expires_on ?? '',
    instructions: row.instructions,
    location: row.location,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

const itemSchema = z
  .object({
    kind: z.enum(INVENTORY_KINDS),
    name: requiredText(120, 'Escribe qué es'),
    category: z.union([z.literal(''), z.enum(Object.keys(INVENTORY_CATEGORIES))]).default(''),
    quantity: decimal({ message: 'Escribe la cantidad, por ejemplo 2 o 1,5' }).transform((value) => value ?? 0),
    unit: text(30).default(''),
    minQuantity: decimal({ message: 'Escribe el mínimo, por ejemplo 2' }),
    expiresOn: optionalDay(),
    instructions: text(2000).default(''),
    location: text(120).default(''),
    notes: text(1000).default(''),
  })
  .transform((data) => ({ ...data, category: data.kind === 'general' ? data.category || 'otros' : '' }));

/** Medicación ordenada por caducidad (lo que caduca antes, arriba); el resto por categoría y nombre. */
export function listItems(kind) {
  const order =
    kind === 'medicacion'
      ? 'expires_on IS NULL, expires_on, name COLLATE NOCASE'
      : 'category, name COLLATE NOCASE';
  return db.prepare(`SELECT * FROM inventory_items WHERE kind = ? ORDER BY ${order}`).all(kind).map(serializeItem);
}

/** Avisos para el resumen: medicación caducada o a punto, y lo que se está acabando. */
export function inventoryAlerts(now = new Date()) {
  const soon = new Date(now);
  soon.setDate(soon.getDate() + EXPIRY_WARNING_DAYS);
  return {
    expiring: db
      .prepare(
        `SELECT * FROM inventory_items WHERE kind = 'medicacion' AND expires_on IS NOT NULL AND expires_on <= ?
         ORDER BY expires_on LIMIT 10`,
      )
      .all(today(soon))
      .map(serializeItem),
    low: db
      .prepare(
        `SELECT * FROM inventory_items WHERE min_quantity IS NOT NULL AND quantity <= min_quantity
         ORDER BY name COLLATE NOCASE LIMIT 10`,
      )
      .all()
      .map(serializeItem),
  };
}

export function adminInventoryRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    const kind = INVENTORY_KINDS.includes(req.query.tipo) ? req.query.tipo : 'medicacion';
    const counts = Object.fromEntries(
      INVENTORY_KINDS.map((k) => [k, db.prepare('SELECT COUNT(*) AS n FROM inventory_items WHERE kind = ?').get(k).n]),
    );
    res.json({ kind, items: listItems(kind), counts, categories: INVENTORY_CATEGORIES, today: today() });
  });

  router.post('/', (req, res) => {
    const data = parseBody(itemSchema, req, res);
    if (!data) return;
    const info = db
      .prepare(
        `INSERT INTO inventory_items (kind, name, category, quantity, unit, min_quantity, expires_on, instructions, location, notes)
         VALUES (@kind, @name, @category, @quantity, @unit, @minQuantity, @expiresOn, @instructions, @location, @notes)`,
      )
      .run({ ...data, expiresOn: data.expiresOn || null });
    res.status(201).json({ item: serializeItem(db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(info.lastInsertRowid)) });
  });

  router.put('/:id', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(itemSchema, req, res);
    if (!data) return;
    const info = db
      .prepare(
        `UPDATE inventory_items SET kind = @kind, name = @name, category = @category, quantity = @quantity,
           unit = @unit, min_quantity = @minQuantity, expires_on = @expiresOn, instructions = @instructions,
           location = @location, notes = @notes, updated_at = datetime('now')
         WHERE id = @id`,
      )
      .run({ ...data, expiresOn: data.expiresOn || null, id });
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos esto en el inventario' });
    res.json({ item: serializeItem(db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id)) });
  });

  // Sumar o restar con un toque (+1 / −1) sin abrir la ficha. Nunca baja de 0.
  router.patch('/:id/cantidad', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(z.object({ delta: z.number().min(-10_000).max(10_000) }), req, res);
    if (!data) return;
    const info = db
      .prepare(
        "UPDATE inventory_items SET quantity = MAX(0, quantity + ?), updated_at = datetime('now') WHERE id = ?",
      )
      .run(data.delta, id);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos esto en el inventario' });
    res.json({ item: serializeItem(db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id)) });
  });

  router.delete('/:id', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const info = db.prepare('DELETE FROM inventory_items WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos esto en el inventario' });
    res.json({ ok: true });
  });

  return router;
}
