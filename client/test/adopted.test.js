import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adopterProvinces, adoptionYears, EMPTY_ADOPTED_FILTERS, filterAdopted } from '../src/lib/adopted.js';

const cats = [
  { id: 1, name: 'Luna', sex: 'hembra', fileNumber: '2026-001', adoptedAt: '2026-03-02', adopter: { name: 'Ana López', phone: '600 112 233', province: 'Badajoz', municipality: 'Mérida', contractNumber: 'A-2026-001' } },
  { id: 2, name: 'Tofu', sex: 'macho', fileNumber: '2025-014', adoptedAt: '2025-11-20', adopter: { name: 'Íñigo Ruiz', phone: '611 000 111', province: 'Madrid', municipality: 'Getafe', contractNumber: 'A-2025-009' } },
  { id: 3, name: 'Nube', sex: 'hembra', fileNumber: '', adoptedAt: '2026-06-10', adopter: null },
];
const names = (list) => list.map((c) => c.name);
const f = (extra) => ({ ...EMPTY_ADOPTED_FILTERS, ...extra });

test('filtros de adoptados: año, sexo, zona y con o sin adoptante', () => {
  assert.deepEqual(adoptionYears(cats), ['2026', '2025']);
  assert.deepEqual(adopterProvinces(cats), ['Badajoz', 'Madrid']);
  assert.deepEqual(names(filterAdopted(cats, f({ year: '2026' }))), ['Luna', 'Nube']);
  assert.deepEqual(names(filterAdopted(cats, f({ sex: 'macho' }))), ['Tofu']);
  assert.deepEqual(names(filterAdopted(cats, f({ zone: 'fuera' }))), ['Tofu']);
  assert.deepEqual(names(filterAdopted(cats, f({ zone: 'extremadura' }))), ['Luna']);
  assert.deepEqual(names(filterAdopted(cats, f({ zone: 'Madrid' }))), ['Tofu']);
  assert.deepEqual(names(filterAdopted(cats, f({ adopter: 'sin' }))), ['Nube']);
});

test('la búsqueda mira gatito, adoptante, teléfono y contrato, sin tildes', () => {
  assert.deepEqual(names(filterAdopted(cats, f({ query: 'inigo' }))), ['Tofu']);
  assert.deepEqual(names(filterAdopted(cats, f({ query: '600112233' }))), ['Luna']);
  assert.deepEqual(names(filterAdopted(cats, f({ query: 'A-2025' }))), ['Tofu']);
  assert.deepEqual(names(filterAdopted(cats, f({ query: 'luna merida' }))), ['Luna']);
});
