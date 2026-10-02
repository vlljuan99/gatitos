import { db } from '../db.js';
import { PUBLIC_URL } from '../config.js';
import { getContent } from '../content.js';
import { ageText } from '../og.js';
import { serializeContract } from '../routes/adminInbox.js';
import { serializeLogEntry, serializeVisit } from '../routes/adminCatRecords.js';
import { serializeFoster } from '../routes/adminFosters.js';
import { listItems, INVENTORY_CATEGORIES } from '../routes/adminInventory.js';
import { DONATION_METHODS, listDonations } from '../routes/adminDonations.js';
import { today } from '../numbers.js';

// Prepara los datos de cada papel a partir de la base de datos. Las
// plantillas (catDocs.js, agreements.js, lists.js) solo dibujan.

function parseTags(value) {
  try {
    const tags = JSON.parse(value);
    return Array.isArray(tags) ? tags : [];
  } catch {
    return [];
  }
}

/** mimoso → mimosa para las gatitas (igual que en la web). */
function feminize(text) {
  const [first, ...rest] = text.split(' ');
  let word = first;
  if (/o$/.test(word)) word = `${word.slice(0, -1)}a`;
  else if (/ón$/.test(word)) word = `${word.slice(0, -2)}ona`;
  else if (/án$/.test(word)) word = `${word.slice(0, -2)}ana`;
  else if (/or$/.test(word)) word = `${word}a`;
  return [word, ...rest].join(' ');
}

export function legalData() {
  const legal = getContent('legal');
  return { ...legal, web: PUBLIC_URL.replace(/^https?:\/\//, '') };
}

/** Texto de una visita al veterinario para el historial. */
function visitText(visit) {
  const parts = [`Veterinario (parte ${visit.number})${visit.clinic ? ` en ${visit.clinic}` : ''}`];
  if (visit.diagnosis) parts.push(visit.diagnosis);
  if (visit.tests) parts.push(`Pruebas: ${visit.tests}`);
  if (visit.treatment) parts.push(`Tratamiento: ${visit.treatment}`);
  if (visit.medication) parts.push(`Medicación: ${visit.medication}`);
  if (visit.nextCheck) {
    const [y, m, d] = visit.nextCheck.split('-');
    parts.push(`Próxima revisión: ${d}/${m}/${y}`);
  }
  return `${parts.map((part) => part.trim().replace(/[.\s]+$/, '')).join('. ')}.`;
}

/** Todo lo que los papeles saben de un gato. null si no existe. */
export function catPaperData(catId) {
  const row = db.prepare('SELECT * FROM cats WHERE id = ?').get(catId);
  if (!row) return null;
  const fosterRow = row.foster_id ? db.prepare('SELECT * FROM fosters WHERE id = ?').get(row.foster_id) : null;
  const visits = db
    .prepare('SELECT * FROM vet_visits WHERE cat_id = ? ORDER BY date DESC, id DESC')
    .all(catId)
    .map(serializeVisit);
  const log = db.prepare('SELECT * FROM cat_log WHERE cat_id = ? ORDER BY date, id').all(catId).map(serializeLogEntry);
  const adopter = db
    .prepare(
      `SELECT name FROM applications WHERE cat_id = ? AND (status = 'adoptado' OR contract_number IS NOT NULL)
       ORDER BY status = 'adoptado' DESC, contract_date DESC, id DESC LIMIT 1`,
    )
    .get(catId);
  const sex = row.sex;
  const tags = parseTags(row.personality).map((t) => (sex === 'hembra' ? feminize(t) : t));
  const status = row.status;
  const inFoster = Boolean(fosterRow) && !['adoptado', 'colonia'].includes(status);
  // La visita más reciente que ya tiene algo de la clínica; si no, la última.
  const vet = visits.find((v) => v.clinic || v.diagnosis || v.treatment) ?? visits[0] ?? null;
  const history = [
    ...log.map((e) => ({ date: e.date, text: e.body, order: e.createdAt })),
    ...visits.map((v) => ({ date: v.date, text: visitText(v), order: v.createdAt })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sex,
    age: ageText(row.birth_date),
    breed: row.breed,
    coat: row.coat,
    microchipped: Boolean(row.microchipped) || Boolean(row.microchip_number),
    microchipNumber: row.microchip_number,
    sterilized: Boolean(row.sterilized),
    vaccinated: Boolean(row.vaccinated),
    fileNumber: row.file_number ?? '',
    arrivedAt: row.arrived_at ?? '',
    status,
    intake: { place: row.intake_place, by: row.intake_by, phone: row.intake_phone, reason: row.intake_reason },
    colony: { member: row.colony_member, name: row.colony_name, caretaker: row.colony_caretaker, earTipped: row.ear_tipped },
    foster: fosterRow ? { ...serializeFoster(fosterRow), since: row.foster_since ?? '' } : null,
    vet,
    hasVetVisits: visits.length > 0,
    personality: tags.join(', '),
    pending: row.pending,
    history,
    situation: {
      treatment: Boolean(row.in_treatment),
      foster: inFoster,
      adoption: status === 'disponible' || status === 'reservado',
      adopted: status === 'adoptado',
      colony: status === 'colonia',
    },
    outcome: {
      date: status === 'adoptado' ? row.adopted_at ?? '' : status === 'colonia' ? row.returned_at ?? '' : '',
      person: status === 'adoptado' ? adopter?.name ?? '' : status === 'colonia' ? row.colony_caretaker : '',
    },
  };
}

export function visitPaperData(visitId) {
  const row = db.prepare('SELECT * FROM vet_visits WHERE id = ?').get(visitId);
  if (!row) return null;
  return { visit: serializeVisit(row), cat: catPaperData(row.cat_id) };
}

export function contractPaperData(applicationId) {
  const row = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!row) return null;
  const contract = serializeContract(row);
  return {
    cat: row.cat_id ? catPaperData(row.cat_id) : row.cat_name ? { name: row.cat_name } : null,
    adopter: {
      name: row.name,
      email: row.email,
      phone: row.phone,
      municipality: row.municipality,
      province: row.province,
      ...contract,
    },
    contract: { number: contract.number, date: contract.date || today(), place: 'Almendralejo' },
  };
}

/** Persona para el compromiso de confidencialidad: alguien del equipo, una casa de acogida, del voluntariado o del transporte solidario. */
export function personPaperData(kind, id) {
  const base = { place: 'Almendralejo', date: '' };
  if (kind === 'equipo') {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row ? { ...base, name: row.name, email: row.email, role: row.role } : null;
  }
  if (kind === 'acogida') {
    const row = db.prepare('SELECT * FROM fosters WHERE id = ?').get(id);
    return row ? { ...base, name: row.name, dni: row.dni, phone: row.phone, email: row.email, role: 'acogida' } : null;
  }
  if (kind === 'voluntariado' || kind === 'transporte') {
    const table = kind === 'voluntariado' ? 'volunteers' : 'transport_volunteers';
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    return row ? { ...base, name: row.name, phone: row.phone, email: row.email, role: 'voluntariado' } : null;
  }
  return null;
}

export const inventoryPaperData = (kind) => ({
  items: listItems(kind),
  categories: INVENTORY_CATEGORIES,
  today: today(),
});

export function donationsPaperData(from, to) {
  return { ...listDonations(from, to), from, to, methods: DONATION_METHODS };
}
