import { test } from 'node:test';
import assert from 'node:assert/strict';
import { euros, feeText, MEMBER_STATES, periodEnd, suggestPeriod } from '../src/lib/members.js';

// Socios y socias: textos de las cuotas y el periodo que se enseña antes de
// apuntar un pago (el servidor calcula lo mismo; ver server/test/members.test.js).

test('las cuotas se leen en euros, sin decimales si no hacen falta', () => {
  assert.equal(euros(5), '5 €');
  assert.equal(euros(12.5), '12,50 €');
  assert.equal(feeText(5, 'mensual'), '5 € al mes');
  assert.equal(feeText(50, 'anual'), '50 € al año');
});

test('el periodo de un pago sigue al anterior si se renueva a tiempo', () => {
  assert.equal(periodEnd('2026-10-18', 'trimestral'), '2027-01-17');
  assert.deepEqual(suggestPeriod({ paidUntil: '2026-10-31', paidOn: '2026-10-25', period: 'mensual', count: 2 }), {
    from: '2026-11-01',
    to: '2026-12-31',
  });
  assert.deepEqual(suggestPeriod({ paidUntil: null, paidOn: '2026-10-18', period: 'anual' }), { from: '2026-10-18', to: '2027-10-17' });
});

test('cada estado tiene su etiqueta', () => {
  assert.deepEqual(Object.keys(MEMBER_STATES), ['pendiente', 'al_dia', 'renovar', 'caducada', 'baja']);
});
