import { client, loggedIn, startServer } from './helpers.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db.js';
import { MAIL } from '../src/config.js';
import { saveContent, getContent } from '../src/content.js';
import { MEMBER_PERIOD_KEYS, MEMBER_SIGNUP_METHODS } from '../src/forms.js';
import {
  addMonths,
  eurosInWords,
  MEMBER_METHODS,
  MEMBER_PERIODS,
  memberState,
  numberInWords,
  periodEnd,
  suggestPeriod,
} from '../src/members.js';
import { purgeOldData } from '../src/maintenance.js';
import { today } from '../src/numbers.js';
import * as clientMembers from '../../client/src/lib/members.js';

// Socios y socias: alta en la web, pagos en el panel y recibo por correo con
// el PDF adjunto (importe y periodo cubierto).

let server;
let admin;
let helper;
let anon;
const TODAY = today();
const YEAR = TODAY.slice(0, 4);

// El servidor corre en este mismo proceso: se interceptan solo las llamadas a
// Resend para ver qué correos saldrían, sin tocar las de las pruebas.
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.resend.com/')) {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: `correo-${sent.length}` }), { status: 200 });
  }
  return realFetch(url, init);
};

before(async () => {
  server = await startServer();
  admin = await loggedIn(server.base, 'admin');
  helper = await loggedIn(server.base, 'cuidabigotes');
  anon = client(server.base);
});
after(() => {
  globalThis.fetch = realFetch;
  return server.close();
});

const signup = (overrides = {}) => ({
  name: 'Marta Socia Gatuna',
  email: 'Marta@Ejemplo.es',
  phone: '611 222 333',
  municipality: 'Almendralejo',
  amount: 50,
  period: 'anual',
  method: 'bizum',
  message: '',
  adult: true,
  privacy: true,
  ...overrides,
});

function withMail(fn) {
  return async () => {
    Object.assign(MAIL, { resendApiKey: 're_prueba', from: 'Bigotes <hola@bigotes.test>', notifyTo: 'equipo@bigotes.test' });
    try {
      await fn();
    } finally {
      Object.assign(MAIL, { resendApiKey: '', from: '', notifyTo: '' });
    }
  };
}

async function createMember(body = {}) {
  const res = await helper.post('/api/admin/socios', { name: 'Pepe Socio', email: 'pepe@ejemplo.es', fee: 5, period: 'mensual', ...body });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data.member;
}

describe('cálculos', () => {
  test('las opciones son las mismas en la web y en el servidor', () => {
    assert.deepEqual(Object.keys(clientMembers.MEMBER_PERIODS), Object.keys(MEMBER_PERIODS));
    assert.deepEqual(Object.keys(clientMembers.MEMBER_PERIODS), MEMBER_PERIOD_KEYS);
    assert.deepEqual(Object.keys(clientMembers.MEMBER_METHODS), Object.keys(MEMBER_METHODS));
    assert.deepEqual(clientMembers.SIGNUP_METHODS.map((m) => m.value), MEMBER_SIGNUP_METHODS);
    for (const [key, value] of Object.entries(MEMBER_PERIODS)) assert.equal(clientMembers.MEMBER_PERIODS[key].months, value.months);
  });

  test('el periodo cubierto: meses sin día 31, varias cuotas y renovaciones', () => {
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
    assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
    assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
    assert.equal(periodEnd('2026-10-18', 'anual'), '2027-10-17');
    assert.equal(periodEnd('2026-10-01', 'mensual', 3), '2026-12-31');
    // Primer pago: desde el día del pago.
    assert.deepEqual(suggestPeriod({ paidUntil: null, paidOn: '2026-10-18', period: 'trimestral' }), { from: '2026-10-18', to: '2027-01-17' });
    // Renueva a tiempo o con poco retraso: sigue justo después.
    assert.deepEqual(suggestPeriod({ paidUntil: '2026-10-31', paidOn: '2026-10-20', period: 'mensual' }), { from: '2026-11-01', to: '2026-11-30' });
    assert.deepEqual(suggestPeriod({ paidUntil: '2026-10-31', paidOn: '2026-11-20', period: 'mensual' }), { from: '2026-11-01', to: '2026-11-30' });
    // Mucho después: vuelve a empezar el día del pago.
    assert.deepEqual(suggestPeriod({ paidUntil: '2026-01-31', paidOn: '2026-10-18', period: 'mensual' }), { from: '2026-10-18', to: '2026-11-17' });
    // La web calcula lo mismo para enseñarlo antes de guardar.
    for (const args of [
      { paidUntil: null, paidOn: '2026-03-31', period: 'mensual', count: 2 },
      { paidUntil: '2026-12-31', paidOn: '2026-12-02', period: 'anual' },
    ]) {
      assert.deepEqual(clientMembers.suggestPeriod(args), suggestPeriod(args));
    }
  });

  test('el estado de cada socio/a', () => {
    assert.equal(memberState({ status: 'pendiente', paidUntil: null }, '2026-10-18'), 'pendiente');
    assert.equal(memberState({ status: 'activo', paidUntil: '2027-01-01' }, '2026-10-18'), 'al_dia');
    assert.equal(memberState({ status: 'activo', paidUntil: '2026-10-30' }, '2026-10-18'), 'renovar');
    assert.equal(memberState({ status: 'activo', paidUntil: '2026-10-17' }, '2026-10-18'), 'caducada');
    assert.equal(memberState({ status: 'baja', paidUntil: '2027-01-01' }, '2026-10-18'), 'baja');
  });

  test('el importe en letra', () => {
    assert.equal(eurosInWords(100), 'un euro');
    assert.equal(eurosInWords(500), 'cinco euros');
    assert.equal(eurosInWords(2100), 'veintiún euros');
    assert.equal(eurosInWords(3150), 'treinta y un euros con cincuenta céntimos');
    assert.equal(eurosInWords(10000), 'cien euros');
    assert.equal(eurosInWords(11601), 'ciento dieciséis euros con un céntimo');
    assert.equal(eurosInWords(150000), 'mil quinientos euros');
    assert.equal(eurosInWords(2100000), 'veintiún mil euros');
    assert.equal(numberInWords(999), 'novecientos noventa y nueve');
  });
});

describe('alta desde la web', () => {
  test('queda pendiente del primer pago y devuelve cómo pagar', async () => {
    saveContent('donations', { ...getContent('donations'), bizum: '01234', iban: 'ES12 3456 7890 1234 5678 9012' });
    const res = await anon.post('/api/socios', signup());
    assert.equal(res.status, 201, JSON.stringify(res.data));
    assert.equal(res.data.payment.bizum, '01234');
    assert.equal(res.data.payment.fee, '50,00 € al año');
    assert.match(res.data.payment.concept, /^Cuota socio\/a Marta/);
    assert.ok(res.data.payment.concept.length <= 35);
    const row = db.prepare("SELECT * FROM members WHERE name = 'Marta Socia Gatuna'").get();
    assert.equal(row.status, 'pendiente');
    assert.equal(row.email, 'marta@ejemplo.es');
    assert.equal(row.fee_cents, 5000);
    assert.equal(row.number, null);
    assert.equal(row.source, 'web');
  });

  test('valida la cuota y los permisos', async () => {
    let res = await anon.post('/api/socios', signup({ amount: '', privacy: false }));
    assert.equal(res.status, 400);
    assert.equal(res.data.fields.amount, 'Elige tu cuota');
    assert.ok(res.data.fields.privacy);
    res = await anon.post('/api/socios', signup({ amount: '0,50' }));
    assert.equal(res.data.fields.amount, 'La cuota tiene que ser de al menos 1 €');
    // Otra cantidad: se admite mientras «Textos de la web» lo permita.
    res = await anon.post('/api/socios', signup({ name: 'Cuota libre', amount: '7,5', period: 'mensual' }));
    assert.equal(res.status, 201);
    saveContent('members', { ...getContent('members'), allowCustom: false });
    res = await anon.post('/api/socios', signup({ name: 'Otra cuota', amount: 8, period: 'mensual' }));
    assert.equal(res.status, 400);
    assert.equal(res.data.fields.amount, 'Elige una de las cuotas');
    res = await anon.post('/api/socios', signup({ name: 'Cuota de la lista', amount: 15, period: 'trimestral' }));
    assert.equal(res.status, 201);
    saveContent('members', { ...getContent('members'), allowCustom: true });
    // El campo trampa: responde bien pero no guarda nada.
    res = await anon.post('/api/socios', signup({ name: 'Robot', website: 'http://spam.example' }));
    assert.equal(res.status, 201);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM members WHERE name = 'Robot'").get().n, 0);
  });

  test(
    'avisa al equipo y da la bienvenida con los datos para pagar',
    withMail(async () => {
      sent.length = 0;
      const res = await anon.post('/api/socios', signup({ name: 'Lucía Bienvenida', email: 'lucia@ejemplo.es' }));
      assert.equal(res.status, 201);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const team = sent.find((m) => m.to[0] === 'equipo@bigotes.test');
      const welcome = sent.find((m) => m.to[0] === 'lucia@ejemplo.es');
      assert.match(team.subject, /Lucía Bienvenida quiere hacerse socio\/a/);
      assert.match(welcome.text, /01234/);
      assert.match(welcome.html, /ES12 3456 7890 1234 5678 9012/);
      assert.match(welcome.html, /Cuota socio\/a Lucía/);
    }),
  );
});

describe('panel', () => {
  test('al apuntar el primer pago tiene número, recibo y el periodo que cubre', async () => {
    const member = await createMember({ name: 'Ana Primera', fee: 15, period: 'trimestral', dni: '12345678Z' });
    assert.equal(member.state, 'pendiente');
    const res = await helper.post(`/api/admin/socios/${member.id}/pagos`, {
      paidOn: TODAY,
      amount: '15',
      periodFrom: TODAY,
      periodTo: periodEnd(TODAY, 'trimestral'),
      method: 'bizum',
    });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    assert.equal(res.data.payment.receiptNumber, `R-${YEAR}-001`);
    assert.equal(res.data.payment.amount, 15);
    assert.equal(res.data.member.number, 1);
    assert.equal(res.data.member.status, 'activo');
    assert.equal(res.data.member.joinedOn, TODAY);
    assert.equal(res.data.member.paidUntil, periodEnd(TODAY, 'trimestral'));
    assert.equal(res.data.member.state, 'al_dia');
    // Sin correo configurado no se envía, y se dice por qué.
    assert.equal(res.data.email.sent, false);
    assert.match(res.data.email.reason, /no está configurado/);
    assert.match(res.data.payment.emailError, /no está configurado/);
    assert.equal(res.data.payment.emailedAt, null);

    // El siguiente número sigue la serie.
    const other = await createMember({ name: 'Bea Segunda' });
    const second = await helper.post(`/api/admin/socios/${other.id}/pagos`, {
      paidOn: TODAY,
      amount: 5,
      periodFrom: TODAY,
      periodTo: periodEnd(TODAY, 'mensual'),
      method: 'efectivo',
      sendEmail: false,
    });
    assert.equal(second.data.payment.receiptNumber, `R-${YEAR}-002`);
    assert.equal(second.data.member.number, 2);
  });

  test(
    'manda el recibo por correo con el PDF adjunto, el importe y el periodo',
    withMail(async () => {
      sent.length = 0;
      const member = await createMember({ name: 'Carla Recibo', email: 'carla@ejemplo.es', fee: 50, period: 'anual' });
      const res = await helper.post(`/api/admin/socios/${member.id}/pagos`, {
        paidOn: '2025-01-15',
        amount: '50,00',
        periodFrom: '2025-01-15',
        periodTo: '2026-01-14',
        method: 'transferencia',
      });
      assert.equal(res.status, 201, JSON.stringify(res.data));
      assert.equal(res.data.email.sent, true);
      assert.equal(res.data.payment.emailedTo, 'carla@ejemplo.es');
      assert.ok(res.data.payment.emailedAt);
      assert.equal(res.data.payment.emailError, '');
      assert.equal(sent.length, 1);
      const mail = sent[0];
      assert.deepEqual(mail.to, ['carla@ejemplo.es']);
      assert.equal(mail.subject, 'Tu recibo de Bigotes · R-2025-001');
      assert.match(mail.text, /Importe: 50,00 €/);
      assert.match(mail.text, /Periodo cubierto: del 15\/01\/2025 al 14\/01\/2026/);
      assert.match(mail.html, /¡Gracias, Carla!/);
      assert.equal(mail.attachments.length, 1);
      assert.match(mail.attachments[0].filename, /^recibo-r-2025-001-carla-recibo\.pdf$/);
      assert.ok(Buffer.from(mail.attachments[0].content, 'base64').toString('latin1').startsWith('%PDF-'));

      // Reenviar: vuelve a salir.
      const again = await helper.post(`/api/admin/socios/${member.id}/pagos/${res.data.payment.id}/enviar`);
      assert.equal(again.status, 200);
      assert.equal(again.data.email.sent, true);
      assert.equal(sent.length, 2);
    }),
  );

  test('sin email no se puede mandar, pero el pago queda apuntado', async () => {
    const member = await createMember({ name: 'Sin Correo', email: '' });
    const res = await helper.post(`/api/admin/socios/${member.id}/pagos`, {
      paidOn: TODAY,
      amount: 5,
      periodFrom: TODAY,
      periodTo: periodEnd(TODAY, 'mensual'),
      method: 'efectivo',
    });
    assert.equal(res.status, 201);
    assert.match(res.data.email.reason, /No tiene email/);
  });

  test('valida los pagos', async () => {
    const member = await createMember({ name: 'Pago Raro' });
    let res = await helper.post(`/api/admin/socios/${member.id}/pagos`, {
      paidOn: '2999-01-01',
      amount: '',
      periodFrom: '2026-05-01',
      periodTo: '2026-06-01',
      method: 'cheque',
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.fields.amount, 'Escribe el importe');
    assert.equal(res.data.fields.paidOn, 'La fecha no puede ser futura');
    assert.ok(res.data.fields.method);
    res = await helper.post(`/api/admin/socios/${member.id}/pagos`, {
      paidOn: TODAY,
      amount: 5,
      periodFrom: '2026-05-01',
      periodTo: '2026-04-01',
      method: 'bizum',
    });
    assert.equal(res.data.fields.periodTo, 'Tiene que ser después del inicio');
  });

  test('lista, recuentos y aviso en el resumen', async () => {
    const res = await helper.get('/api/admin/socios');
    assert.equal(res.status, 200);
    assert.ok(res.data.counts.pendiente >= 1);
    assert.ok(res.data.counts.al_dia >= 2);
    assert.equal(res.data.mailEnabled, false);
    assert.equal(res.data.payTo.bizum, '01234');
    assert.ok(res.data.totals.collected >= 20);
    const summary = await helper.get('/api/admin/resumen');
    assert.ok(summary.data.members.new >= 1);
    assert.equal(typeof summary.data.members.renew, 'number');
  });

  test('cuotas por renovar o vencidas', async () => {
    const member = await createMember({ name: 'Renueva Pronto' });
    const soon = new Date(`${TODAY}T12:00:00Z`);
    soon.setUTCDate(soon.getUTCDate() + 5);
    const soonIso = soon.toISOString().slice(0, 10);
    await helper.post(`/api/admin/socios/${member.id}/pagos`, {
      paidOn: TODAY,
      amount: 5,
      periodFrom: '2026-01-01',
      periodTo: soonIso,
      method: 'bizum',
      sendEmail: false,
    });
    const res = await helper.get(`/api/admin/socios/${member.id}`);
    assert.equal(res.data.member.state, 'renovar');
    assert.equal(res.data.payments.length, 1);
  });

  test('bajas, altas y borrar: los recibos se guardan', async () => {
    const member = await createMember({ name: 'Dani Baja' });
    const pay = await helper.post(`/api/admin/socios/${member.id}/pagos`, {
      paidOn: TODAY,
      amount: 5,
      periodFrom: TODAY,
      periodTo: periodEnd(TODAY, 'mensual'),
      method: 'bizum',
      sendEmail: false,
    });
    let res = await helper.patch(`/api/admin/socios/${member.id}/estado`, { status: 'baja' });
    assert.equal(res.data.member.state, 'baja');
    assert.equal(res.data.member.leftOn, TODAY);
    res = await helper.patch(`/api/admin/socios/${member.id}/estado`, { status: 'activo' });
    assert.equal(res.data.member.status, 'activo');
    assert.equal(res.data.member.leftOn, null);

    // Cuidabigotes no borra; un bigote mayor tampoco mientras tenga recibos.
    res = await helper.delete(`/api/admin/socios/${member.id}`);
    assert.equal(res.status, 403);
    res = await admin.delete(`/api/admin/socios/${member.id}`);
    assert.equal(res.status, 409);
    assert.match(res.data.error, /Dale de baja/);
    res = await helper.delete(`/api/admin/socios/${member.id}/pagos/${pay.data.payment.id}`);
    assert.equal(res.status, 403);
    res = await admin.delete(`/api/admin/socios/${member.id}/pagos/${pay.data.payment.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.data.member.status, 'pendiente');
    assert.equal(res.data.member.number !== null, true, 'el número no se reutiliza');
    res = await admin.delete(`/api/admin/socios/${member.id}`);
    assert.equal(res.status, 200);
  });

  test('editar datos y pagos', async () => {
    const member = await createMember({ name: 'Edu Edita' });
    let res = await helper.put(`/api/admin/socios/${member.id}`, {
      name: 'Eduardo Edita',
      dni: '11111111H',
      email: 'EDU@ejemplo.es',
      phone: '',
      address: 'C/ Mayor, 1',
      municipality: 'Villafranca de los Barros',
      fee: '6,5',
      period: 'mensual',
      method: 'bizum',
      notes: 'Paga a primeros de mes',
    });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.member.fee, 6.5);
    assert.equal(res.data.member.email, 'edu@ejemplo.es');
    const pay = await helper.post(`/api/admin/socios/${member.id}/pagos`, {
      paidOn: TODAY,
      amount: 6.5,
      periodFrom: TODAY,
      periodTo: periodEnd(TODAY, 'mensual'),
      method: 'bizum',
      sendEmail: false,
    });
    res = await helper.put(`/api/admin/socios/${member.id}/pagos/${pay.data.payment.id}`, {
      paidOn: TODAY,
      amount: 13,
      periodFrom: TODAY,
      periodTo: periodEnd(TODAY, 'mensual', 2),
      method: 'bizum',
      notes: 'Eran dos meses',
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.payment.amount, 13);
    assert.equal(res.data.member.paidUntil, periodEnd(TODAY, 'mensual', 2));
  });
});

describe('papeles', () => {
  const A4 = [595.28, 841.89];
  const A5 = [419.53, 595.28];
  function assertPdf(res, [width, height], pages = 1) {
    assert.equal(res.status, 200, typeof res.data === 'string' ? res.data.slice(0, 200) : JSON.stringify(res.data));
    assert.match(res.headers.get('content-type'), /application\/pdf/);
    const boxes = [...res.data.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [Number(m[1]), Number(m[2])]);
    assert.equal(boxes.length, pages);
    for (const [w, h] of boxes) assert.ok(Math.abs(w - width) < 1 && Math.abs(h - height) < 1, `página de ${w}×${h}`);
  }

  test('recibo, hoja de inscripción y libro de socios, rellenos y en blanco', async () => {
    const payment = db.prepare('SELECT id, member_id FROM member_payments ORDER BY id LIMIT 1').get();
    let res = await helper.get(`/api/papeles/recibo/${payment.id}`);
    assertPdf(res, A5);
    assert.match(res.headers.get('content-disposition'), /recibo-r-\d{4}-001/);
    res = await helper.get(`/api/papeles/recibo/${payment.id}?hoja=a4`);
    assertPdf(res, [841.89, 595.28]);
    res = await helper.get(`/api/papeles/socio/${payment.member_id}/inscripcion`);
    assertPdf(res, A5);
    res = await helper.get('/api/papeles/socios');
    assertPdf(res, A4);
    for (const type of ['recibo', 'inscripcion']) assertPdf(await helper.get(`/api/papeles/en-blanco/${type}`), A5);
    assertPdf(await helper.get('/api/papeles/en-blanco/socios'), A4);
    res = await helper.get('/api/papeles/recibo/99999');
    assert.equal(res.status, 404);
    res = await anon.get(`/api/papeles/recibo/${payment.id}`);
    assert.equal(res.status, 401);
  });
});

describe('privacidad', () => {
  test('borra las altas de la web que nunca pagaron, no a quien tiene recibos', () => {
    const insert = db.prepare(
      "INSERT INTO members (name, fee_cents, period, status, updated_at) VALUES (?, 500, 'mensual', ?, datetime('now', '-13 months'))",
    );
    insert.run('Vieja sin pagar', 'pendiente');
    const old = insert.run('Vieja con recibo', 'pendiente').lastInsertRowid;
    db.prepare(
      "INSERT INTO member_payments (member_id, receipt_number, paid_on, amount_cents, period_from, period_to) VALUES (?, 'R-2020-001', '2020-01-01', 500, '2020-01-01', '2020-01-31')",
    ).run(old);
    const removed = purgeOldData(12);
    assert.equal(removed.members, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM members WHERE name LIKE 'Vieja%'").get().n, 1);
  });
});
