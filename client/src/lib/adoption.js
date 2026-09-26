// Pasos y validación del formulario de adopción (sin React, para poder probarlo).
// El servidor vuelve a validarlo todo: esto solo evita pasos en falso.

export const STEPS = [
  { key: 'gatito', title: 'El gatito', emoji: '😻', fields: ['catSlug'] },
  { key: 'tu', title: 'Sobre ti', emoji: '👋', fields: ['name', 'email', 'phone', 'municipality', 'province', 'adult'] },
  { key: 'hogar', title: 'Tu hogar', emoji: '🏡', fields: ['housingType', 'tenure', 'petsAllowed', 'windowsSafe'] },
  {
    key: 'familia',
    title: 'Tu familia',
    emoji: '👨‍👩‍👧',
    fields: ['adults', 'kids', 'kidsAges', 'allAgree', 'allergies', 'otherPets'],
  },
  { key: 'dia', title: 'Tu día a día', emoji: '☀️', fields: ['hoursAlone', 'experience', 'holidays', 'why'] },
  { key: 'enviar', title: 'Compromisos', emoji: '💌', fields: ['commitVet', 'commitSterilize', 'commitFollowUp', 'privacy'] },
];

export const INITIAL_APPLICATION = {
  catSlug: '',
  name: '',
  email: '',
  phone: '',
  municipality: '',
  province: '',
  adult: false,
  housingType: '',
  tenure: '',
  petsAllowed: 'no_aplica',
  windowsSafe: '',
  adults: '',
  kids: '',
  kidsAges: '',
  allAgree: '',
  allergies: '',
  otherPets: '',
  experience: '',
  hoursAlone: '',
  holidays: '',
  why: '',
  commitVet: false,
  commitSterilize: false,
  commitFollowUp: false,
  privacy: false,
  website: '',
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^\+?[\d\s().-]{9,20}$/;

export const OUTSIDE_EXTREMADURA = 'De momento solo damos en adopción en Extremadura (Badajoz y Cáceres)';

export function validateStep(key, v) {
  const errors = {};
  const required = (field, message) => {
    if (v[field] === '' || v[field] === null || v[field] === undefined) errors[field] = message;
  };
  if (key === 'tu') {
    if (!v.name.trim()) errors.name = 'Escribe tu nombre';
    if (!EMAIL_RE.test(v.email.trim())) errors.email = 'Escribe un email válido';
    if (!PHONE_RE.test(v.phone.trim())) errors.phone = 'Escribe un teléfono válido';
    if (!v.municipality.trim()) errors.municipality = 'Escribe tu municipio';
    if (!v.province) errors.province = 'Elige tu provincia';
    else if (v.province === 'otra') errors.province = OUTSIDE_EXTREMADURA;
    if (!v.adult) errors.adult = 'Tienes que ser mayor de edad';
  }
  if (key === 'hogar') {
    required('housingType', 'Elige un tipo de vivienda');
    required('tenure', 'Elige una opción');
    if (v.tenure === 'alquiler' && !['si', 'no', 'no_se'].includes(v.petsAllowed)) {
      errors.petsAllowed = 'Cuéntanos si tu casero permite animales';
    }
    required('windowsSafe', 'Elige una opción');
  }
  if (key === 'familia') {
    const adults = Number(v.adults);
    if (!Number.isInteger(adults) || adults < 1) errors.adults = 'Indica cuántas personas adultas sois';
    required('kids', 'Elige una opción');
    required('allAgree', 'Elige una opción');
    required('allergies', 'Elige una opción');
  }
  if (key === 'dia') {
    required('hoursAlone', 'Elige una opción');
    if (!v.why.trim()) errors.why = 'Cuéntanos un poquito por qué quieres adoptar';
  }
  if (key === 'enviar') {
    for (const field of ['commitVet', 'commitSterilize', 'commitFollowUp']) {
      if (!v[field]) errors[field] = 'Marca este compromiso para continuar';
    }
    if (!v.privacy) errors.privacy = 'Necesitamos tu permiso para tratar estos datos';
  }
  return errors;
}

/** Paso donde está el primer campo con error (para llevar allí a la persona). */
export function stepOfField(field) {
  const index = STEPS.findIndex((step) => step.fields.includes(field));
  return index === -1 ? STEPS.length - 1 : index;
}

export function applicationPayload(values) {
  const { website, ...rest } = values;
  return {
    ...rest,
    adults: Number(values.adults),
    kidsAges: values.kids === 'si' ? values.kidsAges : '',
    petsAllowed: values.tenure === 'alquiler' ? values.petsAllowed : 'no_aplica',
    website,
  };
}
