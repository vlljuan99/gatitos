import { db } from './db.js';
import { getContent } from './content.js';
import { centsToEuros, nextNumber, today } from './numbers.js';

// Socios y socias: personas que pagan una cuota periódica a la asociación.
// Se apuntan desde la web (o las da de alta el equipo), pagan por Bizum,
// transferencia o en mano y, al apuntar el pago en el panel, reciben su
// recibo por correo con el importe y el periodo que cubre. De momento no hay
// pasarela de pago: el pago lo confirma el equipo.
// Periodicidades y formas de pago: deben coincidir con client/src/lib/members.js.

export const MEMBER_PERIODS = {
  mensual: { months: 1, label: 'Mensual', every: 'al mes' },
  trimestral: { months: 3, label: 'Trimestral', every: 'al trimestre' },
  semestral: { months: 6, label: 'Semestral', every: 'al semestre' },
  anual: { months: 12, label: 'Anual', every: 'al año' },
};

export const MEMBER_METHODS = {
  bizum: 'Bizum',
  transferencia: 'Transferencia',
  efectivo: 'En mano',
  tarjeta: 'Tarjeta / TPV',
  otro: 'Otra',
};

/** Días antes del vencimiento en los que el panel avisa para renovar. */
export const RENEW_NOTICE_DAYS = 15;
/** Si se paga con un retraso de hasta tantos días, el periodo sigue justo después del anterior. */
export const GRACE_DAYS = 31;

// ---------------------------------------------------------------------------
// Fechas (AAAA-MM-DD, sin horas ni zonas)
// ---------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');

export function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Suma meses; si el día no existe en el mes de llegada, el último (31/01 + 1 mes = 28/02). */
export function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, last))}`;
}

/** Último día que cubren `count` cuotas que empiezan en `from`. */
export function periodEnd(from, period, count = 1) {
  return addDays(addMonths(from, MEMBER_PERIODS[period].months * count), -1);
}

/**
 * Periodo que cubre un pago nuevo. Si lo pagado sigue vigente (o venció hace
 * poco), empieza justo después; si no, el día del pago.
 */
export function suggestPeriod({ paidUntil, paidOn, period, count = 1 }) {
  const from = paidUntil && paidUntil >= addDays(paidOn, -GRACE_DAYS) ? addDays(paidUntil, 1) : paidOn;
  return { from, to: periodEnd(from, period, count) };
}

/** pendiente (aún no ha pagado), al_dia, renovar (vence pronto), caducada o baja. */
export function memberState({ status, paidUntil }, now = today()) {
  if (status === 'baja') return 'baja';
  if (!paidUntil) return 'pendiente';
  if (paidUntil < now) return 'caducada';
  if (paidUntil <= addDays(now, RENEW_NOTICE_DAYS)) return 'renovar';
  return 'al_dia';
}

// ---------------------------------------------------------------------------
// Importes
// ---------------------------------------------------------------------------

/** 1250 → «12,50 €». */
export const formatEuros = (cents) =>
  `${(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const UNITS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece',
  'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós',
  'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function belowThousand(n) {
  if (n === 100) return 'cien';
  const parts = [];
  if (n >= 100) parts.push(HUNDREDS[Math.floor(n / 100)]);
  const rest = n % 100;
  if (rest) parts.push(rest < 30 ? UNITS[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? ` y ${UNITS[rest % 10]}` : ''}`);
  return parts.join(' ');
}

// «uno» delante de un nombre masculino: «veintiún euros», «treinta y un mil».
const apocope = (words) => words.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');

/** Número entero en letra (hasta 999 999 999). */
export function numberInWords(n) {
  if (n === 0) return 'cero';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (millions) parts.push(millions === 1 ? 'un millón' : `${apocope(numberInWords(millions))} millones`);
  if (thousands) parts.push(thousands === 1 ? 'mil' : `${apocope(belowThousand(thousands))} mil`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
}

/** 5050 → «cincuenta euros con cincuenta céntimos». */
export function eurosInWords(cents) {
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  const main = `${apocope(numberInWords(euros))} ${euros === 1 ? 'euro' : 'euros'}`;
  return rest ? `${main} con ${apocope(numberInWords(rest))} ${rest === 1 ? 'céntimo' : 'céntimos'}` : main;
}

// ---------------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------------

const MEMBER_SELECT = `
  SELECT m.*,
    (SELECT MAX(period_to) FROM member_payments p WHERE p.member_id = m.id) AS paid_until,
    (SELECT MAX(paid_on) FROM member_payments p WHERE p.member_id = m.id) AS last_paid_on,
    (SELECT COUNT(*) FROM member_payments p WHERE p.member_id = m.id) AS payments_count
  FROM members m`;

export function serializeMember(row, now = today()) {
  const paidUntil = row.paid_until ?? null;
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    dni: row.dni,
    email: row.email,
    phone: row.phone,
    address: row.address,
    municipality: row.municipality,
    fee: centsToEuros(row.fee_cents),
    period: row.period,
    method: row.method,
    status: row.status,
    source: row.source,
    message: row.message,
    notes: row.notes,
    joinedOn: row.joined_on,
    leftOn: row.left_on,
    paidUntil,
    lastPaidOn: row.last_paid_on ?? null,
    paymentsCount: row.payments_count ?? 0,
    state: memberState({ status: row.status, paidUntil }, now),
    seenAt: row.seen_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializePayment(row) {
  return {
    id: row.id,
    memberId: row.member_id,
    receiptNumber: row.receipt_number,
    paidOn: row.paid_on,
    amount: centsToEuros(row.amount_cents),
    periodFrom: row.period_from,
    periodTo: row.period_to,
    method: row.method,
    notes: row.notes,
    emailedAt: row.emailed_at,
    emailedTo: row.emailed_to,
    emailError: row.email_error,
    createdAt: row.created_at,
  };
}

export function loadMember(id) {
  const row = db.prepare(`${MEMBER_SELECT} WHERE m.id = ?`).get(id);
  return row ? serializeMember(row) : null;
}

export function listMembers() {
  return db
    .prepare(`${MEMBER_SELECT} ORDER BY m.status = 'baja', m.number IS NULL DESC, m.number, m.name`)
    .all()
    .map((row) => serializeMember(row));
}

export function memberPayments(memberId) {
  return db
    .prepare('SELECT * FROM member_payments WHERE member_id = ? ORDER BY period_to DESC, id DESC')
    .all(memberId)
    .map(serializePayment);
}

export function loadPayment(id) {
  const row = db.prepare('SELECT * FROM member_payments WHERE id = ?').get(id);
  return row ? serializePayment(row) : null;
}

/**
 * Recuentos para el resumen del panel. new: altas pendientes del primer pago
 * que nadie del equipo ha abierto todavía; renew: cuotas por renovar.
 */
export function memberAlerts(now = today()) {
  const members = listMembers().filter((m) => m.status !== 'baja');
  return {
    new: members.filter((m) => m.state === 'pendiente' && !m.seenAt).length,
    renew: members.filter((m) => m.state === 'renovar' || m.state === 'caducada').length,
    active: members.filter((m) => m.state === 'al_dia' || m.state === 'renovar').length,
  };
}

export const nextReceiptNumber = (year) => nextNumber('member_payments', 'receipt_number', 'R-', year);
export const nextMemberNumber = () => db.prepare('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM members').get().n;

/**
 * Cómo pagar la primera cuota, para la web y el correo de bienvenida: Bizum e
 * IBAN de «Textos de la web → Donaciones» y un concepto para reconocer el pago.
 */
export function paymentInstructions({ name, amount, period }) {
  const { bizum, iban } = getContent('donations');
  const concept = `Cuota socio/a ${name}`.slice(0, 35).trim();
  const how = [bizum && ['Bizum', bizum], iban && ['Transferencia (IBAN)', iban]].filter(Boolean);
  return { concept, how, bizum, iban, fee: `${formatEuros(Math.round(amount * 100))} ${MEMBER_PERIODS[period].every}` };
}
