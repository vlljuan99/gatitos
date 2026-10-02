import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { photosFor } from '../cats.js';
import { EXTREMADURA } from '../forms.js';
import { nextContractNumber, today } from '../numbers.js';
import { optionalDay, parseBody, parseId, requiredText, text } from '../validation.js';
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
    outsideExtremadura: !EXTREMADURA.includes(row.province),
    catId: row.cat_id,
    catName: row.cat_name,
    catSlug: row.cat_slug ?? null,
    notesCount: row.notes_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeContract(row) {
  return {
    number: row.contract_number ?? '',
    date: row.contract_date ?? '',
    dni: row.dni ?? '',
    birthDate: row.birth_date ?? '',
    address: row.address ?? '',
    postalCode: row.postal_code ?? '',
    altContactName: row.alt_contact_name ?? '',
    altContactPhone: row.alt_contact_phone ?? '',
    altContactRelation: row.alt_contact_relation ?? '',
  };
}

const contractSchema = z.object({
  dni: text(20).default(''),
  birthDate: optionalDay(),
  address: text(200).default(''),
  postalCode: z.union([z.literal(''), z.string().trim().regex(/^\d{5}$/, 'El código postal tiene 5 cifras')]).default(''),
  altContactName: text(120).default(''),
  altContactPhone: text(30).default(''),
  altContactRelation: text(60).default(''),
  contractDate: optionalDay(),
  catId: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform((value) => value ?? null),
});

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
    const transport = transportByProvince();
    const rows = db
      .prepare(
        `SELECT a.*, c.slug AS cat_slug,
           (SELECT COUNT(*) FROM application_notes n WHERE n.application_id = a.id) AS notes_count
         FROM applications a LEFT JOIN cats c ON c.id = a.cat_id
         ${status ? 'WHERE a.status = ?' : ''}
         ORDER BY a.created_at DESC, a.id DESC`,
      )
      .all(...(status ? [status] : []));
    res.json({
      applications: rows.map((row) => {
        const application = serializeApplication(row);
        // Fuera de Extremadura: cuántas personas del transporte solidario viajan a su provincia.
        if (application.outsideExtremadura) application.transportCount = transport.get(row.province)?.length ?? 0;
        return application;
      }),
      counts: countsBy('applications', APPLICATION_STATUSES),
    });
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
    const application = serializeApplication(row);
    return {
      ...application,
      transport: application.outsideExtremadura ? transportByProvince().get(row.province) ?? [] : null,
      contract: serializeContract(row),
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

  // Datos que pide el contrato de adopción y no están en la solicitud (DNI,
  // dirección…). Al guardarlos por primera vez se reserva el n.º de contrato.
  router.put('/:id/contrato', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(contractSchema, req, res);
    if (!data) return;
    const current = db.prepare('SELECT contract_number, cat_id FROM applications WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'No encontramos esta solicitud' });
    let cat = null;
    if (data.catId) {
      cat = db.prepare('SELECT id, name FROM cats WHERE id = ?').get(data.catId);
      if (!cat) return res.status(400).json({ error: 'Revisa los campos marcados', fields: { catId: 'Ese gatito ya no existe' } });
    }
    const contractDate = data.contractDate || today();
    db.transaction(() => {
      const number = current.contract_number ?? nextContractNumber(Number(contractDate.slice(0, 4)));
      db.prepare(
        `UPDATE applications SET dni = @dni, birth_date = @birthDate, address = @address, postal_code = @postalCode,
           alt_contact_name = @altContactName, alt_contact_phone = @altContactPhone,
           alt_contact_relation = @altContactRelation, contract_number = @number, contract_date = @contractDate,
           updated_at = datetime('now')
         WHERE id = @id`,
      ).run({ ...data, birthDate: data.birthDate || null, number, contractDate, id });
      if (cat && cat.id !== current.cat_id) {
        db.prepare('UPDATE applications SET cat_id = ?, cat_name = ? WHERE id = ?').run(cat.id, cat.name, id);
      }
      if (!current.contract_number) {
        db.prepare('INSERT INTO application_notes (application_id, user_id, author_name, body) VALUES (?, ?, ?, ?)').run(
          id,
          req.user.id,
          req.user.name,
          `Ha preparado el contrato de adopción ${number}`,
        );
      }
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

export const TRANSPORT_STATUSES = ['nuevo', 'activo', 'archivado'];

export function serializeTransport(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    origin: row.origin,
    destinations: parseJson(row.destinations, []),
    frequency: row.frequency,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Transporte solidario por provincia de destino (sin las personas
 * archivadas): primero las ya confirmadas. Cada una lleva las ciudades a las
 * que va dentro de esa provincia.
 */
export function transportByProvince() {
  const rows = db
    .prepare(
      `SELECT * FROM transport_volunteers WHERE status != 'archivado'
       ORDER BY status = 'activo' DESC, created_at DESC`,
    )
    .all()
    .map(serializeTransport);
  const map = new Map();
  for (const person of rows) {
    for (const province of new Set(person.destinations.map((d) => d.province))) {
      if (!map.has(province)) map.set(province, []);
      map.get(province).push({ ...person, cities: person.destinations.filter((d) => d.province === province).map((d) => d.city) });
    }
  }
  return map;
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

export const adminTransportRouter = () =>
  inboxRouter({ table: 'transport_volunteers', statuses: TRANSPORT_STATUSES, serialize: serializeTransport });
