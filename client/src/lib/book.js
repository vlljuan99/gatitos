import { ageGroup } from './cats.js';

// Lógica del libro de gatos, separada de la interfaz para poder probarla.

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
 * Páginas del libro: los gatitos disponibles que pasen los filtros (los
 * reservados no, para no ilusionar a nadie; los adoptados, tampoco).
 */
export function bookPages(cats, { filters = EMPTY_FILTERS, now = new Date() } = {}) {
  return cats.filter((cat) => cat.status === 'disponible' && matchesFilters(cat, filters, now));
}
