import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeFilterCount, EMPTY_FILTERS, feedPosts, handle, hashtags, matchesFilters, storyCats } from '../src/lib/miaustagram.js';

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

test('historias: trocitos por gatito y cómo se avanza', async () => {
  const { storySegments, stepStory, jumpStory } = await import('../src/lib/miaustagram.js');
  const luna = cat('luna', { photos: [{ id: 1 }, { id: 2 }], videos: [{ id: 9 }] });
  assert.deepEqual(storySegments(luna).map((s) => s.key), ['video-9', 'foto-1', 'foto-2']);
  assert.deepEqual(storySegments(cat('nube', { photos: [] })).map((s) => s.key), ['ilustracion']);

  const counts = [3, 1];
  assert.deepEqual(stepStory({ cat: 0, seg: 0 }, 1, counts), { cat: 0, seg: 1 });
  assert.deepEqual(stepStory({ cat: 0, seg: 2 }, 1, counts), { cat: 1, seg: 0 });
  assert.equal(stepStory({ cat: 1, seg: 0 }, 1, counts), null, 'tras el último, se cierra');
  assert.deepEqual(stepStory({ cat: 1, seg: 0 }, -1, counts), { cat: 0, seg: 0 });
  assert.deepEqual(stepStory({ cat: 0, seg: 0 }, -1, counts), { cat: 0, seg: 0 }, 'el primero vuelve a empezar');
  assert.deepEqual(jumpStory({ cat: 0, seg: 2 }, 1, counts), { cat: 1, seg: 0 });
  assert.equal(jumpStory({ cat: 0, seg: 0 }, -1, counts), null);
});
