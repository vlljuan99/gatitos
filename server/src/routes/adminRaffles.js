import { randomInt } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { centsToEuros } from '../numbers.js';
import { parseBody, parseId, requiredDecimal, requiredText, text } from '../validation.js';

// Sorteos benéficos (la cesta de Navidad…). Cada papeleta compra
// participaciones y cada participación trae varios números al azar entre los
// que siguen libres; la clave (raffle_id, number) impide repetir uno aunque
// dos personas den papeletas a la vez. El ganador se saca aquí mismo entre los
// números dados (así siempre hay premio, se vendan los que se vendan) y cada
// extracción queda apuntada: la 1 es el premio y las siguientes, suplentes.
// Con la primera extracción el sorteo se cierra: ya no se dan ni se anulan
// papeletas. Borrar es cosa de un bigote mayor.

export const RAFFLE_DESIGNS = ['cesta', 'sencillo'];

/** Cifras con las que se escriben los números: 1000 números → 000 a 999. */
export const numberDigits = (total) => String(Math.max(1, total - 1)).length;

/**
 * Elige `count` números al azar entre `free` (sin repetir), con el azar
 * criptográfico de Node. `pick` permite inyectar otro azar en las pruebas.
 */
export function pickRandom(free, count, pick = randomInt) {
  const pool = [...free];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const j = pick(pool.length);
    out.push(pool[j]);
    pool[j] = pool[pool.length - 1];
    pool.pop();
  }
  return out;
}

const raffleSchema = z.object({
  title: requiredText(80, 'Ponle un nombre al sorteo'),
  prize: text(1000).default(''),
  price: requiredDecimal({ min: 0.5, max: 1000, required: 'Escribe el precio de cada participación', message: 'Escribe un precio entre 0,50 y 1000 €' }),
  numbersPerEntry: z.coerce.number({ message: 'Escribe cuántos números da cada participación' }).int('Tiene que ser un número entero').min(1, 'Al menos 1').max(50, 'Como mucho 50'),
  totalNumbers: z.coerce.number({ message: 'Escribe cuántos números hay' }).int('Tiene que ser un número entero').min(10, 'Al menos 10 números').max(10000, 'Como mucho 10 000 números'),
  drawInfo: text(160).default(''),
  design: z.enum(RAFFLE_DESIGNS).default('sencillo'),
});

const ticketSchema = z.object({
  name: requiredText(80, 'Escribe el nombre de quien compra'),
  phone: text(30).default(''),
  entries: z.coerce.number({ message: 'Indica cuántas participaciones' }).int().min(1, 'Al menos 1 participación').max(100, 'Como mucho 100 participaciones'),
  paid: z.boolean().default(true),
  notes: text(500).default(''),
  // Números que pide la persona; el resto salen al azar.
  wanted: z.array(z.coerce.number().int().min(0)).max(500).default([]),
});

const ticketUpdateSchema = z.object({
  name: requiredText(80, 'Escribe el nombre de quien compra'),
  phone: text(30).default(''),
  paid: z.boolean(),
  notes: text(500).default(''),
});

const drawSchema = z.object({ includeUnpaid: z.boolean().default(false) });

function serializeRaffle(row) {
  const stats = db
    .prepare(
      `SELECT COUNT(*) AS tickets, COALESCE(SUM(entries), 0) AS entries,
              COALESCE(SUM(CASE WHEN paid = 1 THEN amount_cents ELSE 0 END), 0) AS paid_cents,
              COALESCE(SUM(CASE WHEN paid = 0 THEN amount_cents ELSE 0 END), 0) AS unpaid_cents
       FROM raffle_tickets WHERE raffle_id = ?`,
    )
    .get(row.id);
  const sold = db.prepare('SELECT COUNT(*) AS n FROM raffle_numbers WHERE raffle_id = ?').get(row.id).n;
  const draws = db
    .prepare('SELECT * FROM raffle_draws WHERE raffle_id = ? ORDER BY position')
    .all(row.id)
    .map((d) => ({
      position: d.position,
      number: d.number,
      ticketId: d.ticket_id,
      winnerName: d.winner_name,
      poolSize: d.pool_size,
      includeUnpaid: Boolean(d.include_unpaid),
      drawnAt: d.drawn_at,
    }));
  return {
    id: row.id,
    title: row.title,
    prize: row.prize,
    price: centsToEuros(row.price_cents),
    numbersPerEntry: row.numbers_per_entry,
    totalNumbers: row.total_numbers,
    digits: numberDigits(row.total_numbers),
    drawInfo: row.draw_info,
    design: row.design,
    closed: draws.length > 0,
    draws,
    stats: {
      tickets: stats.tickets,
      entries: stats.entries,
      sold,
      free: row.total_numbers - sold,
      paid: centsToEuros(stats.paid_cents),
      unpaid: centsToEuros(stats.unpaid_cents),
    },
    createdAt: row.created_at,
  };
}

function ticketsOf(raffleId) {
  const numbers = new Map();
  for (const r of db.prepare('SELECT ticket_id, number FROM raffle_numbers WHERE raffle_id = ? ORDER BY number').all(raffleId)) {
    if (!numbers.has(r.ticket_id)) numbers.set(r.ticket_id, []);
    numbers.get(r.ticket_id).push(r.number);
  }
  return db
    .prepare('SELECT * FROM raffle_tickets WHERE raffle_id = ? ORDER BY ticket_number DESC')
    .all(raffleId)
    .map((t) => serializeTicket(t, numbers.get(t.id) ?? []));
}

function serializeTicket(row, numbers) {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    name: row.name,
    phone: row.phone,
    entries: row.entries,
    amount: centsToEuros(row.amount_cents),
    paid: Boolean(row.paid),
    notes: row.notes,
    numbers,
    createdAt: row.created_at,
  };
}

const getRaffleRow = (id) => db.prepare('SELECT * FROM raffles WHERE id = ?').get(id);
const isClosed = (id) => Boolean(db.prepare('SELECT 1 FROM raffle_draws WHERE raffle_id = ? LIMIT 1').get(id));

class RaffleError extends Error {
  constructor(message, status = 400, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

/** Da una papeleta con sus números. Todo en una transacción: no se repite ninguno. */
export const createTicket = db.transaction((raffle, data, userId, pick = randomInt) => {
  if (isClosed(raffle.id)) throw new RaffleError('Este sorteo ya se ha celebrado: no se pueden dar más papeletas.', 409);
  const count = data.entries * raffle.numbers_per_entry;
  const wanted = [...new Set(data.wanted)];
  const digits = numberDigits(raffle.total_numbers);
  const fmt = (n) => String(n).padStart(digits, '0');
  const outOfRange = wanted.filter((n) => n >= raffle.total_numbers);
  if (outOfRange.length) {
    throw new RaffleError(`Los números van del ${fmt(0)} al ${fmt(raffle.total_numbers - 1)}.`, 400, { wanted: `No existe: ${outOfRange.map(fmt).join(', ')}` });
  }
  if (wanted.length > count) {
    throw new RaffleError(`Pide ${wanted.length} números, pero con ${data.entries} participación(es) le tocan ${count}.`, 400, { wanted: 'Súmale participaciones o pide menos números' });
  }
  const used = new Set(db.prepare('SELECT number FROM raffle_numbers WHERE raffle_id = ?').pluck().all(raffle.id));
  const taken = wanted.filter((n) => used.has(n));
  if (taken.length) {
    throw new RaffleError(`Ya están dados: ${taken.map(fmt).join(', ')}.`, 409, { wanted: `Ya los tiene otra persona: ${taken.map(fmt).join(', ')}` });
  }
  const wantedSet = new Set(wanted);
  const free = [];
  for (let n = 0; n < raffle.total_numbers; n += 1) if (!used.has(n) && !wantedSet.has(n)) free.push(n);
  const need = count - wanted.length;
  if (free.length < need) {
    throw new RaffleError(
      free.length === 0 ? 'Ya están dados todos los números.' : `Solo quedan ${free.length + wanted.length} números libres y hacen falta ${count}.`,
      409,
      { entries: 'No quedan números suficientes' },
    );
  }
  const numbers = [...wanted, ...pickRandom(free, need, pick)].sort((a, b) => a - b);
  const ticketNumber = db.prepare('SELECT COALESCE(MAX(ticket_number), 0) + 1 FROM raffle_tickets WHERE raffle_id = ?').pluck().get(raffle.id);
  const info = db
    .prepare(
      `INSERT INTO raffle_tickets (raffle_id, ticket_number, name, phone, entries, amount_cents, paid, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(raffle.id, ticketNumber, data.name, data.phone, data.entries, data.entries * raffle.price_cents, data.paid ? 1 : 0, data.notes, userId);
  const insert = db.prepare('INSERT INTO raffle_numbers (raffle_id, number, ticket_id) VALUES (?, ?, ?)');
  for (const n of numbers) insert.run(raffle.id, n, info.lastInsertRowid);
  return serializeTicket(db.prepare('SELECT * FROM raffle_tickets WHERE id = ?').get(info.lastInsertRowid), numbers);
});

/** Saca el siguiente número (ganador o suplente) entre los dados que aún no han salido. */
export const drawNext = db.transaction((raffle, { includeUnpaid }, userId, pick = randomInt) => {
  const pool = db
    .prepare(
      `SELECT n.number, t.id AS ticket_id, t.name FROM raffle_numbers n
       JOIN raffle_tickets t ON t.id = n.ticket_id
       WHERE n.raffle_id = ? ${includeUnpaid ? '' : 'AND t.paid = 1'}
         AND n.number NOT IN (SELECT number FROM raffle_draws WHERE raffle_id = ?)
       ORDER BY n.number`,
    )
    .all(raffle.id, raffle.id);
  if (pool.length === 0) {
    throw new RaffleError(
      includeUnpaid ? 'No hay números dados entre los que sortear.' : 'No hay números pagados entre los que sortear. Marca las papeletas pagadas o incluye las que no lo están.',
      409,
    );
  }
  const chosen = pool[pick(pool.length)];
  const position = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 FROM raffle_draws WHERE raffle_id = ?').pluck().get(raffle.id);
  db.prepare(
    `INSERT INTO raffle_draws (raffle_id, position, number, ticket_id, winner_name, pool_size, include_unpaid, drawn_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(raffle.id, position, chosen.number, chosen.ticket_id, chosen.name, pool.length, includeUnpaid ? 1 : 0, userId);
  return position;
});

function sendRaffle(res, id, status = 200, extra = {}) {
  const row = getRaffleRow(id);
  res.status(status).json({ raffle: serializeRaffle(row), tickets: ticketsOf(id), ...extra });
}

function handle(res, fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof RaffleError) return res.status(err.status).json({ error: err.message, fields: err.fields });
    throw err;
  }
}

export function adminRafflesRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    res.json({ raffles: db.prepare('SELECT * FROM raffles ORDER BY created_at DESC, id DESC').all().map(serializeRaffle) });
  });

  router.post('/', (req, res) => {
    const data = parseBody(raffleSchema, req, res);
    if (!data) return;
    const info = db
      .prepare(
        `INSERT INTO raffles (title, prize, price_cents, numbers_per_entry, total_numbers, draw_info, design, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(data.title, data.prize, Math.round(data.price * 100), data.numbersPerEntry, data.totalNumbers, data.drawInfo, data.design, req.user.id);
    sendRaffle(res, info.lastInsertRowid, 201);
  });

  // Carga el sorteo de la ruta (o responde 404).
  router.param('raffleId', (req, res, next, value) => {
    const id = parseId(value, res);
    if (id === null) return;
    req.raffle = getRaffleRow(id);
    if (!req.raffle) return res.status(404).json({ error: 'No encontramos este sorteo' });
    next();
  });

  router.get('/:raffleId', (req, res) => sendRaffle(res, req.raffle.id));

  router.put('/:raffleId', (req, res) => {
    const data = parseBody(raffleSchema, req, res);
    if (!data) return;
    const raffle = req.raffle;
    const closed = isClosed(raffle.id);
    const hasTickets = Boolean(db.prepare('SELECT 1 FROM raffle_tickets WHERE raffle_id = ? LIMIT 1').get(raffle.id));
    // Con papeletas dadas, lo que cambia los números o el precio no se toca
    // (para que todas las papeletas valgan lo mismo); el resto sí.
    if (hasTickets || closed) {
      const changed =
        Math.round(data.price * 100) !== raffle.price_cents ||
        data.numbersPerEntry !== raffle.numbers_per_entry ||
        data.totalNumbers !== raffle.total_numbers;
      if (changed) {
        return res.status(409).json({
          error: 'Ya hay papeletas dadas: el precio y los números ya no se pueden cambiar.',
          fields: { price: 'Ya no se puede cambiar', numbersPerEntry: 'Ya no se puede cambiar', totalNumbers: 'Ya no se puede cambiar' },
        });
      }
    }
    db.prepare(
      `UPDATE raffles SET title = ?, prize = ?, price_cents = ?, numbers_per_entry = ?, total_numbers = ?, draw_info = ?, design = ?,
         updated_at = datetime('now') WHERE id = ?`,
    ).run(data.title, data.prize, Math.round(data.price * 100), data.numbersPerEntry, data.totalNumbers, data.drawInfo, data.design, raffle.id);
    sendRaffle(res, raffle.id);
  });

  router.delete('/:raffleId', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM raffles WHERE id = ?').run(req.raffle.id);
    res.json({ ok: true });
  });

  router.post('/:raffleId/papeletas', (req, res) => {
    const data = parseBody(ticketSchema, req, res);
    if (!data) return;
    handle(res, () => {
      const ticket = createTicket(req.raffle, data, req.user.id);
      sendRaffle(res, req.raffle.id, 201, { ticket });
    });
  });

  router.put('/:raffleId/papeletas/:ticketId', (req, res) => {
    const ticketId = parseId(req.params.ticketId, res);
    if (ticketId === null) return;
    const data = parseBody(ticketUpdateSchema, req, res);
    if (!data) return;
    const info = db
      .prepare(`UPDATE raffle_tickets SET name = ?, phone = ?, paid = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND raffle_id = ?`)
      .run(data.name, data.phone, data.paid ? 1 : 0, data.notes, ticketId, req.raffle.id);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos esta papeleta' });
    sendRaffle(res, req.raffle.id);
  });

  // Anular una papeleta deja sus números libres. Tras el sorteo, no se puede.
  router.delete('/:raffleId/papeletas/:ticketId', requireAdmin, (req, res) => {
    const ticketId = parseId(req.params.ticketId, res);
    if (ticketId === null) return;
    if (isClosed(req.raffle.id)) return res.status(409).json({ error: 'El sorteo ya se ha celebrado: las papeletas ya no se pueden anular.' });
    const info = db.prepare('DELETE FROM raffle_tickets WHERE id = ? AND raffle_id = ?').run(ticketId, req.raffle.id);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos esta papeleta' });
    sendRaffle(res, req.raffle.id);
  });

  router.post('/:raffleId/sortear', (req, res) => {
    const data = parseBody(drawSchema, req, res);
    if (!data) return;
    handle(res, () => {
      const position = drawNext(req.raffle, data, req.user.id);
      sendRaffle(res, req.raffle.id, 201, { position });
    });
  });

  return router;
}
