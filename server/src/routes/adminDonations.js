import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { centsToEuros, today } from '../numbers.js';
import { decimal, parseBody, parseId, requiredDay, text } from '../validation.js';

// Registro de donaciones: de dinero (importe y forma de pago) y de material
// (pienso, arena, mantas…). Sirve para rendir cuentas y para dar las
// gracias. Cualquiera del equipo apunta; borrar es cosa de un bigote mayor.
// Las formas de pago deben coincidir con client/src/admin/Donations.jsx.

export const DONATION_METHODS = {
  efectivo: 'Efectivo',
  bizum: 'Bizum',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta / TPV',
  paypal: 'PayPal',
  teaming: 'Teaming',
  otro: 'Otra',
};

export function serializeDonation(row) {
  return {
    id: row.id,
    date: row.date,
    kind: row.kind,
    donorName: row.donor_name,
    donorContact: row.donor_contact,
    amount: centsToEuros(row.amount_cents),
    method: row.method,
    description: row.description,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

const donationSchema = z
  .object({
    date: requiredDay(),
    kind: z.enum(['dinero', 'material']),
    donorName: text(120).default(''),
    donorContact: text(120).default(''),
    amount: decimal({ min: 0.01, max: 1_000_000, message: 'Escribe el importe en euros, por ejemplo 20 o 12,50' }),
    method: z.union([z.literal(''), z.enum(Object.keys(DONATION_METHODS))]).default(''),
    description: text(300).default(''),
    notes: text(1000).default(''),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'dinero' && data.amount === null) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Escribe el importe' });
    }
    if (data.kind === 'material' && !data.description) {
      ctx.addIssue({ code: 'custom', path: ['description'], message: 'Cuenta qué han donado' });
    }
    if (data.date > today()) {
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'La fecha no puede ser futura' });
    }
  })
  .transform((data) =>
    data.kind === 'dinero'
      ? { ...data, method: data.method || 'otro' }
      : { ...data, amount: null, method: '' },
  );

/** Donaciones entre dos fechas (incluidas), de la más reciente a la más antigua. */
export function listDonations(from, to) {
  const rows = db
    .prepare('SELECT * FROM donations WHERE date BETWEEN ? AND ? ORDER BY date DESC, id DESC')
    .all(from, to)
    .map(serializeDonation);
  const money = rows.filter((d) => d.kind === 'dinero');
  return {
    donations: rows,
    totals: {
      money: Math.round(money.reduce((sum, d) => sum + d.amount * 100, 0)) / 100,
      moneyCount: money.length,
      materialCount: rows.length - money.length,
    },
  };
}

const isYear = (value) => /^\d{4}$/.test(String(value ?? ''));

export function adminDonationsRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    const year = isYear(req.query.anio) ? Number(req.query.anio) : new Date().getFullYear();
    const years = db
      .prepare("SELECT DISTINCT CAST(strftime('%Y', date) AS INTEGER) AS year FROM donations ORDER BY year DESC")
      .all()
      .map((r) => r.year);
    if (!years.includes(year)) years.unshift(year);
    res.json({ year, years: [...new Set(years)].sort((a, b) => b - a), methods: DONATION_METHODS, ...listDonations(`${year}-01-01`, `${year}-12-31`) });
  });

  router.post('/', (req, res) => {
    const data = parseBody(donationSchema, req, res);
    if (!data) return;
    const info = db
      .prepare(
        `INSERT INTO donations (date, kind, donor_name, donor_contact, amount_cents, method, description, notes, created_by)
         VALUES (@date, @kind, @donorName, @donorContact, @amountCents, @method, @description, @notes, @createdBy)`,
      )
      .run({ ...data, amountCents: data.amount === null ? null : Math.round(data.amount * 100), createdBy: req.user.id });
    res.status(201).json({ donation: serializeDonation(db.prepare('SELECT * FROM donations WHERE id = ?').get(info.lastInsertRowid)) });
  });

  router.put('/:id', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(donationSchema, req, res);
    if (!data) return;
    const info = db
      .prepare(
        `UPDATE donations SET date = @date, kind = @kind, donor_name = @donorName, donor_contact = @donorContact,
           amount_cents = @amountCents, method = @method, description = @description, notes = @notes,
           updated_at = datetime('now')
         WHERE id = @id`,
      )
      .run({ ...data, amountCents: data.amount === null ? null : Math.round(data.amount * 100), id });
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos esta donación' });
    res.json({ donation: serializeDonation(db.prepare('SELECT * FROM donations WHERE id = ?').get(id)) });
  });

  router.delete('/:id', requireAdmin, (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const info = db.prepare('DELETE FROM donations WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos esta donación' });
    res.json({ ok: true });
  });

  return router;
}
