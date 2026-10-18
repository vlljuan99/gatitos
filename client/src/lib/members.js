// Socios y socias (sin React, para poder probarlo). Las claves deben
// coincidir con server/src/members.js y server/src/forms.js; el cálculo del
// periodo es el mismo que hace el servidor, para enseñarlo antes de guardar.

export const MEMBER_PERIODS = {
  mensual: { months: 1, label: 'Mensual', every: 'al mes', short: '/mes' },
  trimestral: { months: 3, label: 'Trimestral', every: 'al trimestre', short: '/trimestre' },
  semestral: { months: 6, label: 'Semestral', every: 'al semestre', short: '/semestre' },
  anual: { months: 12, label: 'Anual', every: 'al año', short: '/año' },
};

export const MEMBER_METHODS = {
  bizum: 'Bizum',
  transferencia: 'Transferencia',
  efectivo: 'En mano',
  tarjeta: 'Tarjeta / TPV',
  otro: 'Otra',
};

/** Cómo puede pagar quien se apunta desde la web. */
export const SIGNUP_METHODS = [
  { value: 'bizum', label: 'Bizum', emoji: '📱' },
  { value: 'transferencia', label: 'Transferencia', emoji: '🏦' },
  { value: 'efectivo', label: 'En mano', emoji: '🤝' },
];

export const RENEW_NOTICE_DAYS = 15;
export const GRACE_DAYS = 31;

const pad = (n) => String(n).padStart(2, '0');

export function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, last))}`;
}

export function periodEnd(from, period, count = 1) {
  return addDays(addMonths(from, MEMBER_PERIODS[period].months * count), -1);
}

export function suggestPeriod({ paidUntil, paidOn, period, count = 1 }) {
  const from = paidUntil && paidUntil >= addDays(paidOn, -GRACE_DAYS) ? addDays(paidUntil, 1) : paidOn;
  return { from, to: periodEnd(from, period, count) };
}

/** 5 → «5 €», 12.5 → «12,50 €». */
export function euros(value) {
  const n = Number(value);
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} €`;
}

/** «5 € al mes». */
export const feeText = (amount, period) => `${euros(amount)} ${MEMBER_PERIODS[period]?.every ?? ''}`.trim();

/** Etiquetas y tonos de cada estado (los calcula el servidor). */
export const MEMBER_STATES = {
  pendiente: { label: 'Pendiente del primer pago', short: 'Nueva', tone: 'bg-mantequilla text-mantequilla-oscuro' },
  al_dia: { label: 'Al día', short: 'Al día', tone: 'bg-menta text-menta-oscuro' },
  renovar: { label: 'Renueva pronto', short: 'Renueva pronto', tone: 'bg-melocoton text-melocoton-oscuro' },
  caducada: { label: 'Cuota vencida', short: 'Vencida', tone: 'bg-melocoton text-melocoton-oscuro' },
  baja: { label: 'De baja', short: 'Baja', tone: 'bg-crema text-cacao-suave' },
};
