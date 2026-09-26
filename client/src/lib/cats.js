// Utilidades puras sobre gatitos (edad, género gramatical, etiquetas). Sin
// React para poder probarlas con node --test.

export function ageInMonths(birthDate, now = new Date()) {
  if (!birthDate) return null;
  const [year, month] = birthDate.split('-').map(Number);
  return Math.max(0, (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month));
}

export function ageText(birthDate, now = new Date()) {
  const months = ageInMonths(birthDate, now);
  if (months === null) return '';
  if (months < 1) return 'menos de un mes';
  if (months < 12) return months === 1 ? '1 mes' : `${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 año' : `${years} años`;
}

export const AGE_GROUPS = [
  { value: 'gatito', label: 'Gatitos', hint: 'menos de 1 año' },
  { value: 'joven', label: 'Jóvenes', hint: '1 a 3 años' },
  { value: 'adulto', label: 'Adultos', hint: '3 a 8 años' },
  { value: 'senior', label: 'Seniors', hint: 'más de 8 años' },
];

export function ageGroup(birthDate, now = new Date()) {
  const months = ageInMonths(birthDate, now);
  if (months === null) return null;
  if (months < 12) return 'gatito';
  if (months < 36) return 'joven';
  if (months < 96) return 'adulto';
  return 'senior';
}

/** Pasa un adjetivo a femenino para las gatitas: mimoso → mimosa, juguetón → juguetona. */
export function feminize(text) {
  const [first, ...rest] = text.split(' ');
  let word = first;
  if (/o$/.test(word)) word = `${word.slice(0, -1)}a`;
  else if (/ón$/.test(word)) word = `${word.slice(0, -2)}ona`;
  else if (/án$/.test(word)) word = `${word.slice(0, -2)}ana`;
  else if (/or$/.test(word)) word = `${word}a`;
  return [word, ...rest].join(' ');
}

export const gendered = (text, sex) => (sex === 'hembra' ? feminize(text) : text);

export const SEX_LABELS = { macho: 'Macho', hembra: 'Hembra', desconocido: 'Sexo sin confirmar' };

export function statusLabel(status, sex) {
  return {
    borrador: 'Borrador',
    disponible: 'Disponible',
    reservado: gendered('Reservado', sex),
    adoptado: gendered('Adoptado', sex),
  }[status];
}

/** «conocerle» / «conocerla» */
export const objectPronoun = (sex) => (sex === 'hembra' ? 'la' : 'le');

export const FIV_FELV_LABELS = {
  negativo: 'Test FIV/FeLV negativo',
  positivo_fiv: 'FIV positivo',
  positivo_felv: 'FeLV positivo',
  pendiente: 'Test FIV/FeLV pendiente',
};

export const COMPAT = [
  { key: 'kids', label: 'Niños' },
  { key: 'cats', label: 'Otros gatos' },
  { key: 'dogs', label: 'Perros' },
];

export const PERSONALITY_TAGS = [
  'mimoso',
  'juguetón',
  'tranquilo',
  'curioso',
  'tímido',
  'charlatán',
  'independiente',
  'dormilón',
  'aventurero',
  'glotón',
  'sociable',
  'cariñoso con niños',
];

/** Color pastel estable por gatito, para ilustraciones y fondos. */
const TONES = ['fresa', 'lavanda', 'menta', 'mantequilla', 'melocoton', 'cielo'];
export const toneFor = (id = 0) => TONES[Math.abs(Number(id)) % TONES.length];
