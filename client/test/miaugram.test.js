import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeFilterCount, EMPTY_FILTERS, feedPosts, handle, hashtags, matchesFilters, storyCats } from '../src/lib/miaugram.js';

const now = new Date('2026-09-15');
const cat = (slug, extra = {}) => ({
  slug,
  status: 'disponible',
  sex: 'hembra',
  birthDate: '2026-05',
  goodWith: { kids: 'si', cats: 'desconocido', dogs: 'no' },
  ...extra,
});

test('el feed solo enseña disponibles: destacados y luego los recién llegados', () => {
  const cats = [
    cat('nube', { status: 'reservado' }),
    cat('luna', { arrivedAt: '2026-08-01' }),
    cat('chispa', { status: 'adoptado' }),
    cat('tofu', { sex: 'macho', arrivedAt: '2026-09-01' }),
    cat('mora', { featured: true, arrivedAt: '2026-01-01' }),
  ];
  assert.deepEqual(feedPosts(cats, { now }).map((c) => c.slug), ['mora', 'tofu', 'luna']);
  assert.deepEqual(feedPosts(cats, { filters: { ...EMPTY_FILTERS, sex: 'macho' }, now }).map((c) => c.slug), ['tofu']);
});

test('historias: primero con vídeo y después los recién llegados', () => {
  const posts = [
    cat('vieja', { arrivedAt: '2026-01-01' }),
    cat('nueva', { arrivedAt: '2026-09-10' }),
    cat('video', { arrivedAt: '2025-01-01', videos: [{ id: 1 }] }),
  ];
  assert.deepEqual(storyCats(posts, now).map((c) => c.slug), ['video', 'nueva']);
});

test('hashtags y nombre de usuario', () => {
  const luna = cat('luna', { personality: ['mimoso', 'buena con niños'] });
  assert.deepEqual(hashtags(luna), ['#mimosa', '#buenaconniños']);
  assert.equal(handle(luna), '@luna');
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
