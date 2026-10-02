import { db } from './db.js';

// Números correlativos por año de los papeles de la asociación:
//   - n.º de ficha de cada gato: «2026-007»
//   - contratos de adopción:     «A-2026-003»
//   - partes veterinarios:       «V-2026-012»

/** Fecha de hoy (AAAA-MM-DD) en la hora local del servidor (Europe/Madrid). */
export function today(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Siguiente número del año para un prefijo. Parte del mayor que ya exista,
 * también si alguien lo escribió a mano (p. ej. al pasar fichas de papel).
 */
export function nextNumber(table, column, prefix, year = new Date().getFullYear()) {
  const start = `${prefix}${year}-`;
  const rows = db.prepare(`SELECT ${column} AS value FROM ${table} WHERE ${column} LIKE ?`).all(`${start}%`);
  let max = 0;
  for (const { value } of rows) {
    const n = Number(value.slice(start.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${start}${String(max + 1).padStart(3, '0')}`;
}

export const nextFileNumber = (year) => nextNumber('cats', 'file_number', '', year);
export const nextContractNumber = (year) => nextNumber('applications', 'contract_number', 'A-', year);
export const nextVetNumber = (year) => nextNumber('vet_visits', 'number', 'V-', year);

/** «12,50», «12.5» o 12.5 → 1250 céntimos. Vacío → null. */
export function eurosToCents(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).trim().replace(/\s|€/g, '').replace(',', '.'));
  if (!Number.isFinite(number)) return NaN;
  return Math.round(number * 100);
}

export const centsToEuros = (cents) => (cents === null || cents === undefined ? null : cents / 100);
