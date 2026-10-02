import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { centsToEuros, nextVetNumber, today } from '../numbers.js';
import { decimal, optionalDay, parseBody, parseId, requiredDay, requiredText, text } from '../validation.js';

// Historial de cada gato: notas con fecha (lo que se apunta en la ficha de
// seguimiento) y visitas al veterinario. Cada visita nace con su parte
// veterinario numerado (V-2026-001): sin parte, la clínica no atiende a
// cargo de la asociación. Al volver se completa con lo que hizo la clínica.

export function serializeVisit(row) {
  return {
    id: row.id,
    catId: row.cat_id,
    number: row.number,
    date: row.date,
    carrierName: row.carrier_name,
    carrierPhone: row.carrier_phone,
    clinic: row.clinic,
    diagnosis: row.diagnosis,
    tests: row.tests,
    treatment: row.treatment,
    medication: row.medication,
    nextCheck: row.next_check ?? '',
    amount: centsToEuros(row.amount_cents),
    createdAt: row.created_at,
  };
}

export function serializeLogEntry(row) {
  return { id: row.id, catId: row.cat_id, date: row.date, body: row.body, author: row.author_name, createdAt: row.created_at };
}

export function catHistory(catId) {
  return {
    entries: db
      .prepare('SELECT * FROM cat_log WHERE cat_id = ? ORDER BY date DESC, id DESC')
      .all(catId)
      .map(serializeLogEntry),
    visits: db
      .prepare('SELECT * FROM vet_visits WHERE cat_id = ? ORDER BY date DESC, id DESC')
      .all(catId)
      .map(serializeVisit),
  };
}

const entrySchema = z.object({
  date: requiredDay(),
  body: requiredText(2000, 'Escribe la nota'),
});

const newVisitSchema = z.object({
  date: requiredDay(),
  carrierName: text(120).default(''),
  carrierPhone: text(30).default(''),
});

const visitSchema = newVisitSchema.extend({
  clinic: text(120).default(''),
  diagnosis: text(1000).default(''),
  tests: text(1000).default(''),
  treatment: text(1000).default(''),
  medication: text(1000).default(''),
  nextCheck: optionalDay(),
  amount: decimal({ max: 100_000, message: 'Escribe el importe en euros, por ejemplo 35,50' }),
});

export function catRecordsRouter() {
  const router = Router({ mergeParams: true });

  // Estas rutas cuelgan de /gatitos/:id: primero, que el gato exista.
  router.use(['/historial', '/veterinario'], (req, res, next) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    if (!db.prepare('SELECT 1 FROM cats WHERE id = ?').get(id)) {
      return res.status(404).json({ error: 'No encontramos a este gatito' });
    }
    req.catId = id;
    next();
  });

  router.get('/historial', (req, res) => {
    res.json(catHistory(req.catId));
  });

  router.post('/historial', (req, res) => {
    const data = parseBody(entrySchema, req, res);
    if (!data) return;
    db.prepare('INSERT INTO cat_log (cat_id, date, body, user_id, author_name) VALUES (?, ?, ?, ?, ?)').run(
      req.catId,
      data.date,
      data.body,
      req.user.id,
      req.user.name,
    );
    res.status(201).json(catHistory(req.catId));
  });

  router.delete('/historial/:entryId', (req, res) => {
    const entryId = parseId(req.params.entryId, res);
    if (entryId === null) return;
    const info = db.prepare('DELETE FROM cat_log WHERE id = ? AND cat_id = ?').run(entryId, req.catId);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos esta nota' });
    res.json(catHistory(req.catId));
  });

  // Nuevo parte: reserva el número y deja la visita «pendiente de completar».
  router.post('/veterinario', (req, res) => {
    const data = parseBody(newVisitSchema, req, res);
    if (!data) return;
    const visit = db.transaction(() => {
      const number = nextVetNumber(Number(data.date.slice(0, 4)));
      const info = db
        .prepare(
          `INSERT INTO vet_visits (cat_id, number, date, carrier_name, carrier_phone, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(req.catId, number, data.date, data.carrierName, data.carrierPhone, req.user.id);
      return db.prepare('SELECT * FROM vet_visits WHERE id = ?').get(info.lastInsertRowid);
    })();
    res.status(201).json({ visit: serializeVisit(visit), ...catHistory(req.catId) });
  });

  router.put('/veterinario/:visitId', (req, res) => {
    const visitId = parseId(req.params.visitId, res);
    if (visitId === null) return;
    const data = parseBody(visitSchema, req, res);
    if (!data) return;
    const info = db
      .prepare(
        `UPDATE vet_visits SET date = @date, carrier_name = @carrierName, carrier_phone = @carrierPhone,
           clinic = @clinic, diagnosis = @diagnosis, tests = @tests, treatment = @treatment,
           medication = @medication, next_check = @nextCheck, amount_cents = @amountCents,
           updated_at = datetime('now')
         WHERE id = @id AND cat_id = @catId`,
      )
      .run({
        ...data,
        nextCheck: data.nextCheck || null,
        amountCents: data.amount === null ? null : Math.round(data.amount * 100),
        id: visitId,
        catId: req.catId,
      });
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos esta visita' });
    const visit = db.prepare('SELECT * FROM vet_visits WHERE id = ?').get(visitId);
    res.json({ visit: serializeVisit(visit), ...catHistory(req.catId) });
  });

  router.delete('/veterinario/:visitId', (req, res) => {
    const visitId = parseId(req.params.visitId, res);
    if (visitId === null) return;
    const info = db.prepare('DELETE FROM vet_visits WHERE id = ? AND cat_id = ?').run(visitId, req.catId);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos esta visita' });
    res.json(catHistory(req.catId));
  });

  return router;
}

/** Revisiones veterinarias de los próximos días (para los avisos del resumen). */
export function upcomingChecks(days = 7) {
  const until = new Date();
  until.setDate(until.getDate() + days);
  return db
    .prepare(
      `SELECT v.cat_id, c.name, MIN(v.next_check) AS next_check FROM vet_visits v JOIN cats c ON c.id = v.cat_id
       WHERE v.next_check BETWEEN ? AND ? AND c.status NOT IN ('adoptado', 'colonia')
       GROUP BY v.cat_id ORDER BY next_check LIMIT 10`,
    )
    .all(today(), today(until))
    .map((row) => ({ catId: row.cat_id, catName: row.name, nextCheck: row.next_check }));
}
