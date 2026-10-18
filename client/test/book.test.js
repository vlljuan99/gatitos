import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeFilterCount, bookPages, EMPTY_FILTERS, matchesFilters } from '../src/lib/book.js';

const now = new Date('2026-09-15');
const cat = (slug, extra = {}) => ({
  slug,
  status: 'disponible',
  sex: 'hembra',
  birthDate: '2026-05',
  goodWith: { kids: 'si', cats: 'desconocido', dogs: 'no' },
  ...extra,
});

test('el libro solo enseña gatitos disponibles', () => {
  const cats = [cat('nube', { status: 'reservado' }), cat('luna'), cat('chispa', { status: 'adoptado' }), cat('tofu', { sex: 'macho' })];
  assert.deepEqual(bookPages(cats, { now }).map((c) => c.slug), ['luna', 'tofu']);
  assert.deepEqual(bookPages(cats, { filters: { ...EMPTY_FILTERS, sex: 'macho' }, now }).map((c) => c.slug), ['tofu']);
});

test('los filtros exigen un «sí» claro en convivencia', () => {
  const luna = cat('luna');
  assert.equal(matchesFilters(luna, { ...EMPTY_FILTERS, kids: true }, now), true);
  assert.equal(matchesFilters(luna, { ...EMPTY_FILTERS, cats: true }, now), false, '«no lo sabemos» no cuenta como sí');
  assert.equal(matchesFilters(luna, { ...EMPTY_FILTERS, ages: ['gatito'] }, now), true);
  assert.equal(matchesFilters(luna, { ...EMPTY_FILTERS, ages: ['senior'] }, now), false);
  assert.equal(matchesFilters(luna, { ...EMPTY_FILTERS, sex: 'macho' }, now), false);
  assert.equal(activeFilterCount({ ...EMPTY_FILTERS, ages: ['gatito', 'joven'], kids: true }), 3);
});
