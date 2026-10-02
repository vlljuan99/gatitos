import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicationPayload, INITIAL_APPLICATION, stepOfField, STEPS, validateStep } from '../src/lib/adoption.js';

const filled = {
  ...INITIAL_APPLICATION,
  name: 'Ana',
  email: 'ana@ejemplo.es',
  phone: '600 123 456',
  municipality: 'Almendralejo',
  province: 'Badajoz',
  adult: true,
  housingType: 'piso',
  tenure: 'propiedad',
  windowsSafe: 'si',
  adults: '2',
  kids: 'no',
  allAgree: 'si',
  allergies: 'no',
  hoursAlone: 'menos_4',
  why: 'Porque sí',
  commitVet: true,
  commitSterilize: true,
  commitFollowUp: true,
  privacy: true,
};

test('un formulario completo pasa todos los pasos', () => {
  for (const step of STEPS) assert.deepEqual(validateStep(step.key, filled), {}, step.key);
});

test('fuera de Extremadura se puede seguir eligiendo la provincia', () => {
  assert.equal(validateStep('tu', { ...filled, province: 'otra' }).province, 'Elige tu provincia');
  assert.deepEqual(validateStep('tu', { ...filled, province: 'Madrid' }), {});
});

test('de alquiler hay que contestar si se permiten animales', () => {
  const errors = validateStep('hogar', { ...filled, tenure: 'alquiler', petsAllowed: '' });
  assert.ok(errors.petsAllowed);
  assert.deepEqual(validateStep('hogar', { ...filled, tenure: 'alquiler', petsAllowed: 'no_se' }), {});
});

test('los errores del servidor llevan al paso de su campo', () => {
  assert.equal(STEPS[stepOfField('email')].key, 'tu');
  assert.equal(STEPS[stepOfField('windowsSafe')].key, 'hogar');
  assert.equal(STEPS[stepOfField('desconocido')].key, 'enviar');
});

test('el envío normaliza campos dependientes', () => {
  const payload = applicationPayload({ ...filled, kidsAges: '5 años', tenure: 'propiedad', petsAllowed: 'si' });
  assert.equal(payload.adults, 2);
  assert.equal(payload.kidsAges, '', 'sin niños no se envían edades');
  assert.equal(payload.petsAllowed, 'no_aplica');
});
