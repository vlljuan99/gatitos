import { ageGroup, gendered } from './cats.js';

// Lógica de Miaustagram (el feed de gatitos tipo red social), separada de la
// interfaz para poder probarla.

export const EMPTY_FILTERS = { ages: [], sex: 'todos', kids: false, cats: false, dogs: false };

export function activeFilterCount(filters) {
  return (
    filters.ages.length +
    (filters.sex !== 'todos' ? 1 : 0) +
    (filters.kids ? 1 : 0) +
    (filters.cats ? 1 : 0) +
    (filters.dogs ? 1 : 0)
  );
}

export function matchesFilters(cat, filters, now = new Date()) {
  if (filters.ages.length && !filters.ages.includes(ageGroup(cat.birthDate, now))) return false;
  if (filters.sex !== 'todos' && cat.sex !== filters.sex) return false;
  if (filters.kids && cat.goodWith.kids !== 'si') return false;
  if (filters.cats && cat.goodWith.cats !== 'si') return false;
  if (filters.dogs && cat.goodWith.dogs !== 'si') return false;
  return true;
}

/**
 * Publicaciones del feed: los gatitos disponibles que pasen los filtros (los
 * reservados no, para no ilusionar a nadie; los adoptados, tampoco). Primero
 * los destacados y después los recién llegados.
 */
export function feedPosts(cats, { filters = EMPTY_FILTERS, now = new Date() } = {}) {
  const arrived = (cat) => cat.arrivedAt || cat.createdAt || '';
  return cats
    .filter((cat) => cat.status === 'disponible' && matchesFilters(cat, filters, now))
    .map((cat, i) => ({ cat, i }))
    .sort((a, b) => (b.cat.featured ? 1 : 0) - (a.cat.featured ? 1 : 0) || arrived(b.cat).localeCompare(arrived(a.cat)) || a.i - b.i)
    .map(({ cat }) => cat);
}

/**
 * Historias (los círculos de arriba): primero los que tienen vídeo y después
 * los recién llegados (últimos 45 días). Como mucho 12.
 */
export function storyCats(posts, now = new Date()) {
  const since = new Date(now);
  since.setDate(since.getDate() - 45);
  const recent = (cat) => cat.arrivedAt && new Date(cat.arrivedAt) >= since;
  const withVideo = posts.filter((cat) => cat.videos?.length);
  const fresh = posts.filter((cat) => !cat.videos?.length && recent(cat));
  return [...withVideo, ...fresh].slice(0, 12);
}

/** Etiquetas del carácter como hashtags: «#mimosa #juguetona». */
export const hashtags = (cat) =>
  cat.personality.map((tag) => `#${gendered(tag, cat.sex).toLowerCase().replace(/\s+/g, '')}`);

/** Nombre de usuario del gatito: @luna. */
export const handle = (cat) => `@${cat.slug}`;

/**
 * Trocitos de la historia de un gatito, como en Instagram: primero sus
 * vídeos y luego sus fotos (como mucho 3 y 4). Sin nada, uno con su
 * ilustración.
 */
export function storySegments(cat) {
  const videos = (cat.videos ?? []).slice(0, 3).map((video) => ({ key: `video-${video.id}`, video }));
  const photos = (cat.photos ?? []).slice(0, 4).map((photo) => ({ key: `foto-${photo.id}`, photo }));
  const all = [...videos, ...photos];
  return all.length ? all : [{ key: 'ilustracion', photo: null }];
}

/**
 * Siguiente posición al tocar a un lado: { cat, seg } o null para cerrar.
 * counts[i] es el número de trocitos del gatito i. Hacia atrás desde el
 * primer trocito se pasa al gatito anterior; desde el primero de todos, se
 * vuelve a empezar.
 */
export function stepStory({ cat, seg }, dir, counts) {
  if (dir > 0) {
    if (seg + 1 < counts[cat]) return { cat, seg: seg + 1 };
    return cat + 1 < counts.length ? { cat: cat + 1, seg: 0 } : null;
  }
  if (seg > 0) return { cat, seg: seg - 1 };
  return cat > 0 ? { cat: cat - 1, seg: 0 } : { cat, seg: 0 };
}

/** Al deslizar de lado se salta al gatito siguiente o anterior (o null). */
export function jumpStory({ cat }, dir, counts) {
  const next = cat + dir;
  return next >= 0 && next < counts.length ? { cat: next, seg: 0 } : null;
}
