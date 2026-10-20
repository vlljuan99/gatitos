import { EXTREMADURA } from './forms.js';

// Filtros de la vista «Adoptados» del panel, separados para poder probarlos.

export const EMPTY_ADOPTED_FILTERS = { query: '', year: 'todos', sex: 'todos', zone: 'todas', adopter: 'todos' };

const normalize = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Año de la adopción (por la fecha de adopción o, si no, la del contrato). */
export const adoptionYear = (cat) => (cat.adoptedAt || cat.adopter?.contractDate || '').slice(0, 4) || null;

/** Años con adopciones, del más reciente al más antiguo. */
export const adoptionYears = (cats) => [...new Set(cats.map(adoptionYear).filter(Boolean))].sort().reverse();

/** Provincias de quienes adoptaron, por orden alfabético. */
export const adopterProvinces = (cats) =>
  [...new Set(cats.map((c) => c.adopter?.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

export function filterAdopted(cats, filters = EMPTY_ADOPTED_FILTERS) {
  const words = normalize(filters.query).split(/\s+/).filter(Boolean);
  return cats.filter((cat) => {
    const a = cat.adopter;
    if (filters.year !== 'todos' && adoptionYear(cat) !== filters.year) return false;
    if (filters.sex !== 'todos' && cat.sex !== filters.sex) return false;
    if (filters.adopter === 'con' && !a) return false;
    if (filters.adopter === 'sin' && a) return false;
    if (filters.zone === 'extremadura' && !(a && EXTREMADURA.includes(a.province))) return false;
    if (filters.zone === 'fuera' && !(a && !EXTREMADURA.includes(a.province))) return false;
    if (!['todas', 'extremadura', 'fuera'].includes(filters.zone) && a?.province !== filters.zone) return false;
    if (words.length) {
      const haystack = normalize(
        [cat.name, cat.fileNumber, cat.microchipNumber, a?.name, a?.phone, a?.email, a?.municipality, a?.province, a?.contractNumber].join(' '),
      );
      // El teléfono se busca también sin espacios.
      const digits = haystack.replace(/\s+/g, '');
      if (!words.every((w) => haystack.includes(w) || digits.includes(w))) return false;
    }
    return true;
  });
}
