// Opciones de los formularios públicos con sus etiquetas visibles. Los valores
// deben coincidir con server/src/forms.js, que es quien valida.

// Provincias de España (igual que en el servidor). Se adopta sobre todo en
// Extremadura; fuera de ella, si alguien del transporte solidario viaja allí.
export const EXTREMADURA = ['Badajoz', 'Cáceres'];
export const PROVINCES = [
  'A Coruña', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Barcelona', 'Bizkaia',
  'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ceuta', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Gipuzkoa',
  'Girona', 'Granada', 'Guadalajara', 'Huelva', 'Huesca', 'Illes Balears', 'Jaén', 'La Rioja', 'Las Palmas', 'León',
  'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Melilla', 'Murcia', 'Navarra', 'Ourense', 'Palencia', 'Pontevedra',
  'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia',
  'Valladolid', 'Zamora', 'Zaragoza',
];
export const OTHER_PROVINCES = PROVINCES.filter((p) => !EXTREMADURA.includes(p));
/** Píldoras de la solicitud: las dos de Extremadura y «Otra provincia» (que abre la lista). */
export const PROVINCE_CHOICES = [
  { value: 'Badajoz', label: 'Badajoz' },
  { value: 'Cáceres', label: 'Cáceres' },
  { value: 'otra', label: 'Otra provincia' },
];

export const TRANSPORT_FREQUENCIES = [
  { value: 'semanal', label: 'Cada semana' },
  { value: 'quincenal', label: 'Cada 15 días' },
  { value: 'mensual', label: 'Una vez al mes' },
  { value: 'ocasional', label: 'De vez en cuando' },
];

export const HOUSING = [
  { value: 'piso', label: 'Piso' },
  { value: 'casa', label: 'Casa' },
  { value: 'casa_patio', label: 'Casa con patio o jardín' },
  { value: 'otro', label: 'Otro' },
];

export const TENURE = [
  { value: 'propiedad', label: 'Es mía' },
  { value: 'alquiler', label: 'De alquiler' },
  { value: 'familiar', label: 'Vivo con mi familia' },
];

export const PETS_ALLOWED = [
  { value: 'si', label: 'Sí, se permiten' },
  { value: 'no', label: 'No' },
  { value: 'no_se', label: 'No lo sé' },
];

export const WINDOWS = [
  { value: 'si', label: 'Sí, ya las tengo' },
  { value: 'me_comprometo', label: 'Todavía no, pero las pondré' },
  { value: 'no', label: 'No' },
];

export const YES_NO = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
];

export const KIDS = [
  { value: 'no', label: 'No' },
  { value: 'si', label: 'Sí' },
];

export const ALLERGIES = [
  { value: 'no', label: 'No' },
  { value: 'si', label: 'Sí' },
  { value: 'no_se', label: 'No lo sé' },
];

export const HOURS_ALONE = [
  { value: 'menos_4', label: 'Menos de 4 horas' },
  { value: '4_8', label: 'Entre 4 y 8 horas' },
  { value: 'mas_8', label: 'Más de 8 horas' },
];

export const VOLUNTEER_AREAS = [
  { value: 'cuidados', label: 'Cuidados y mimos', emoji: '🧺' },
  { value: 'transporte', label: 'Llevar gatitos al veterinario', emoji: '🚗' },
  { value: 'eventos', label: 'Jornadas de adopción y mercadillos', emoji: '🎪' },
  { value: 'fotos', label: 'Hacer fotos bonitas', emoji: '📸' },
  { value: 'redes', label: 'Redes sociales', emoji: '📱' },
  { value: 'difusion', label: 'Carteles y difusión', emoji: '📣' },
  { value: 'otros', label: 'Otras cosas', emoji: '✨' },
];

const labelOf = (options, value) => options.find((o) => o.value === value)?.label ?? value;

/** Respuestas del cuestionario tal y como se enseñan en el panel. */
export const APPLICATION_QUESTIONS = [
  {
    title: 'Hogar',
    items: [
      { key: 'housingType', label: 'Vivienda', format: (v) => labelOf(HOUSING, v) },
      { key: 'tenure', label: 'Régimen', format: (v) => labelOf(TENURE, v) },
      {
        key: 'petsAllowed',
        label: '¿Permiten animales?',
        format: (v) => (v === 'no_aplica' ? null : labelOf(PETS_ALLOWED, v)),
      },
      { key: 'windowsSafe', label: 'Redes en ventanas', format: (v) => labelOf(WINDOWS, v), warn: (v) => v === 'no' },
    ],
  },
  {
    title: 'Familia',
    items: [
      { key: 'adults', label: 'Personas adultas' },
      { key: 'kids', label: 'Niños', format: (v, a) => (v === 'si' ? `Sí${a.kidsAges ? ` (${a.kidsAges})` : ''}` : 'No') },
      { key: 'allAgree', label: '¿Todos de acuerdo?', format: (v) => labelOf(YES_NO, v), warn: (v) => v === 'no' },
      { key: 'allergies', label: 'Alergias', format: (v) => labelOf(ALLERGIES, v), warn: (v) => v === 'si' },
      { key: 'otherPets', label: 'Otros animales' },
    ],
  },
  {
    title: 'Día a día',
    items: [
      { key: 'hoursAlone', label: 'Horas solo en casa', format: (v) => labelOf(HOURS_ALONE, v) },
      { key: 'experience', label: 'Experiencia con gatos' },
      { key: 'holidays', label: 'En vacaciones' },
      { key: 'why', label: '¿Por qué quiere adoptar?' },
    ],
  },
];

export const volunteerAreaLabel = (value) => labelOf(VOLUNTEER_AREAS, value);
export const frequencyLabel = (value) => labelOf(TRANSPORT_FREQUENCIES, value);
