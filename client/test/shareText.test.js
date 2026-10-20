import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catFacts, contactLines, healthItems, listText, shareCaption } from '../src/lib/shareText.js';

const now = new Date('2026-09-15');
const luna = {
  name: 'Luna',
  sex: 'hembra',
  birthDate: '2026-05',
  summary: 'Una bolita de mimos.',
  personality: ['mimoso', 'juguetón', 'curioso'],
  health: { vaccinated: true, dewormed: true, microchipped: true, sterilized: false },
};

test('datos de la imagen en femenino para las gatitas', () => {
  assert.deepEqual(catFacts(luna, now), ['Hembra', '4 meses', 'mimosa', 'juguetona']);
  assert.deepEqual(healthItems(luna), ['Vacunada', 'Desparasitada', 'Con microchip']);
  assert.deepEqual(catFacts({ name: 'X', sex: 'desconocido', birthDate: '', personality: [] }, now), []);
});

test('listas en castellano', () => {
  assert.equal(listText(['a']), 'a');
  assert.equal(listText(['a', 'b', 'c']), 'a, b y c');
});

test('contacto: WhatsApp antes que teléfono, y la web con el Instagram', () => {
  assert.deepEqual(contactLines({ whatsapp: '600 111 222', phone: '924 000 000', instagram: 'bigotes' }, 'bigotes.es/gatitos/luna'), {
    main: 'WhatsApp 600 111 222',
    extra: 'bigotes.es/gatitos/luna · @bigotes',
  });
  assert.deepEqual(contactLines({ phone: '924 000 000' }, 'web'), { main: 'Tel. 924 000 000', extra: 'web' });
  assert.deepEqual(contactLines({}, 'web'), { main: '', extra: 'web' });
});

test('pie de foto con enlace, contacto y sin nada negativo', () => {
  const caption = shareCaption(luna, { whatsapp: '600 111 222' }, 'https://bigotes.es/gatitos/luna', now);
  assert.match(caption, /¡Luna busca hogar!/);
  assert.match(caption, /¿Te has enamorado de ella\?/);
  assert.match(caption, /Se entrega vacunada, desparasitada y con microchip\./);
  assert.match(caption, /https:\/\/bigotes\.es\/gatitos\/luna/);
  assert.match(caption, /WhatsApp 600 111 222/);
  assert.doesNotMatch(caption, /no me gusta|descart/i);
});
