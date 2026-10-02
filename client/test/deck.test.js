import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeFilterCount, buildDeck, EMPTY_FILTERS, matchesFilters, shuffle } from '../src/lib/deck.js';

const now = new Date('2026-09-15');
const cat = (slug, extra = {}) => ({
  slug,
  status: 'disponible',
  sex: 'hembra',
  birthDate: '2026-05',
  goodWith: { kids: 'si', cats: 'desconocido', dogs: 'no' },
  ...extra,
});

test('la baraja excluye reservados, adoptados y favoritos', () => {
  const cats = [cat('luna'), cat('nube', { status: 'reservado' }), cat('chispa', { status: 'adoptado' }), cat('tofu')];
  const deck = buildDeck(cats, { exclude: ['tofu'], now });
  assert.deepEqual(deck, ['luna']);
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

test('barajar no pierde ni repite gatitos', () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const items = ['a', 'b', 'c', 'd', 'e'];
  const result = shuffle(items, random);
  assert.deepEqual([...result].sort(), items);
  assert.deepEqual(items, ['a', 'b', 'c', 'd', 'e'], 'no modifica la lista original');
});
