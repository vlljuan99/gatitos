import { ageGroup } from './cats.js';

// Lógica del modo match, separada de la interfaz para poder probarla.

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

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Baraja del match: solo gatitos disponibles (los reservados no, para no
 * ilusionar a nadie), que pasen los filtros y que no estén ya en favoritos.
 */
export function buildDeck(cats, { filters = EMPTY_FILTERS, exclude = [], random = Math.random, now = new Date() } = {}) {
  const skip = new Set(exclude);
  const pool = cats.filter((cat) => cat.status === 'disponible' && !skip.has(cat.slug) && matchesFilters(cat, filters, now));
  return shuffle(pool, random).map((cat) => cat.slug);
}
