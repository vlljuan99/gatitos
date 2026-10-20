import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageGroup, ageText, feminize, gendered, statusLabel } from '../src/lib/cats.js';

const now = new Date('2026-09-15');

test('edad legible a partir del mes de nacimiento', () => {
  assert.equal(ageText('2026-09', now), 'menos de un mes');
  assert.equal(ageText('2026-05', now), '4 meses');
  assert.equal(ageText('2024-09', now), '2 años');
  assert.equal(ageText('', now), '');
});

test('grupos de edad para los filtros', () => {
  assert.equal(ageGroup('2026-03', now), 'gatito');
  assert.equal(ageGroup('2024-09', now), 'joven');
  assert.equal(ageGroup('2020-01', now), 'adulto');
  assert.equal(ageGroup('2016-01', now), 'senior');
  assert.equal(ageGroup(null, now), null);
});

test('adjetivos en femenino para las gatitas', () => {
  assert.equal(feminize('mimoso'), 'mimosa');
  assert.equal(feminize('juguetón'), 'juguetona');
  assert.equal(feminize('charlatán'), 'charlatana');
  assert.equal(feminize('independiente'), 'independiente');
  assert.equal(feminize('cariñoso con niños'), 'cariñosa con niños');
  assert.equal(gendered('tímido', 'macho'), 'tímido');
  assert.equal(gendered('tímido', 'desconocido'), 'tímido');
  assert.equal(statusLabel('adoptado', 'hembra'), 'Adoptada');
  assert.equal(statusLabel('reservado', 'macho'), 'Reservado');
});
