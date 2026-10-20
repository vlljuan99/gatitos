import { client, loggedIn, startServer, validApplication } from './helpers.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { db, migrations, runMigrations } from '../src/db.js';
import { MAIL, WHATSAPP } from '../src/config.js';
import { waNumber } from '../src/whatsapp.js';

// Avisos de solicitud nueva (correo y WhatsApp), etapas sin «visita» y la
// vista de adoptados con su adoptante.

let server;
let admin;
let anon;

// Se interceptan solo las llamadas a Resend y a WhatsApp (Meta).
const outbox = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('https://api.resend.com/') || u.startsWith('https://graph.facebook.com/')) {
    outbox.push({ url: u, body: JSON.parse(init.body), auth: init.headers.Authorization });
    return new Response('{}', { status: 200 });
  }
  return realFetch(url, init);
};

before(async () => {
  server = await startServer();
  admin = await loggedIn(server.base, 'admin');
  anon = client(server.base);
});
after(() => {
  globalThis.fetch = realFetch;
  return server.close();
});

async function createCat(body) {
  const res = await admin.post('/api/admin/gatitos', { name: 'Luna', status: 'disponible', ...body });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data.cat;
}

const waitFor = async (check) => {
  for (let i = 0; i < 50 && !check(); i += 1) await new Promise((r) => setTimeout(r, 20));
  assert.ok(check(), 'no llegaron los avisos');
};

describe('avisos de una solicitud nueva', () => {
  test('correo y WhatsApp al equipo y a quien la envía', async () => {
    Object.assign(MAIL, { resendApiKey: 're_prueba', from: 'Bigotes <hola@bigotes.test>', notifyTo: 'equipo@bigotes.test' });
    Object.assign(WHATSAPP, {
      token: 'token-de-prueba',
      phoneId: '1234',
      notifyTo: '+34 611 000 000',
      teamTemplate: 'solicitud_nueva',
      adopterTemplate: 'solicitud_recibida',
    });
    try {
      outbox.length = 0;
      const cat = await createCat({ name: 'Mandarina', sex: 'hembra' });
      const res = await anon.post('/api/solicitudes', validApplication({ name: 'Rosa Pérez Gil', phone: '600 123 456', catSlug: cat.slug }));
      assert.equal(res.status, 201);
      await waitFor(() => outbox.length === 4);

      const wa = outbox.filter((m) => m.url.startsWith('https://graph.facebook.com/'));
      assert.equal(wa.length, 2);
      assert.ok(wa.every((m) => m.url.endsWith('/1234/messages') && m.auth === 'Bearer token-de-prueba'));
      const team = wa.find((m) => m.body.template.name === 'solicitud_nueva');
      assert.equal(team.body.to, '34611000000');
      const teamParams = team.body.template.components[0].parameters.map((p) => p.text);
      assert.equal(teamParams[0], 'Rosa Pérez Gil');
      assert.equal(teamParams[1], 'Mandarina');
      assert.match(teamParams[2], /^https:\/\/bigotes\.test\/admin\/solicitudes\/\d+$/);
      const adopter = wa.find((m) => m.body.template.name === 'solicitud_recibida');
      assert.equal(adopter.body.to, '34600123456');
      assert.deepEqual(adopter.body.template.components[0].parameters.map((p) => p.text), ['Rosa', 'Mandarina']);

      const mails = outbox.filter((m) => m.url.startsWith('https://api.resend.com/'));
      assert.deepEqual(mails.map((m) => m.body.to[0]).sort(), ['ana@ejemplo.es', 'equipo@bigotes.test'].sort());
    } finally {
      Object.assign(MAIL, { resendApiKey: '', from: '', notifyTo: '' });
      Object.assign(WHATSAPP, { token: '', phoneId: '', notifyTo: '', teamTemplate: '', adopterTemplate: '' });
    }
  });

  test('sin configurar WhatsApp no se llama a Meta', async () => {
    outbox.length = 0;
    const res = await anon.post('/api/solicitudes', validApplication());
    assert.equal(res.status, 201);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(outbox.length, 0);
  });

  test('los teléfonos se pasan al formato internacional', () => {
    assert.equal(waNumber('600 12 34 56'), '34600123456');
    assert.equal(waNumber('+34 600-123-456'), '34600123456');
    assert.equal(waNumber('0034600123456'), '34600123456');
    assert.equal(waNumber('123'), '');
  });
});

describe('etapas de la solicitud', () => {
  test('«visita» ya no es una etapa: se une con «aprobada»', async () => {
    const res = await anon.post('/api/solicitudes', validApplication());
    assert.equal(res.status, 201);
    const id = db.prepare('SELECT id FROM applications ORDER BY id DESC LIMIT 1').get().id;
    assert.equal((await admin.patch(`/api/admin/solicitudes/${id}`, { status: 'visita' })).status, 400);
    assert.equal((await admin.patch(`/api/admin/solicitudes/${id}`, { status: 'aprobada' })).status, 200);
    const list = await admin.get('/api/admin/solicitudes');
    assert.equal(list.data.counts.visita, undefined);
  });

  test('la migración pasa las que estaban en visita a aprobada', () => {
    const old = new Database(':memory:');
    const before = migrations.findIndex((m) => (typeof m === 'string' ? m : m.sql).includes("WHERE status = 'visita'"));
    assert.ok(before > 0);
    for (const [i, entry] of migrations.slice(0, before).entries()) {
      old.exec(typeof entry === 'string' ? entry : entry.sql);
      old.pragma(`user_version = ${i + 1}`);
    }
    old.prepare("INSERT INTO applications (status, name, email, phone, municipality, province) VALUES ('visita', 'Eva', 'eva@x.es', '600000000', 'Mérida', 'Badajoz')").run();
    runMigrations(old);
    assert.equal(old.prepare('SELECT status FROM applications').get().status, 'aprobada');
  });
});

describe('adoptados', () => {
  test('cada gatito adoptado sale con quien lo adoptó y su contrato', async () => {
    const cat = await createCat({ name: 'Garbancita', sex: 'hembra' });
    const res = await anon.post('/api/solicitudes', validApplication({ name: 'Lola Martín', municipality: 'Getafe', province: 'Madrid', catSlug: cat.slug }));
    assert.equal(res.status, 201);
    const id = db.prepare('SELECT id FROM applications ORDER BY id DESC LIMIT 1').get().id;
    const contract = await admin.put(`/api/admin/solicitudes/${id}/contrato`, { dni: '12345678Z', address: 'C/ Real 1', postalCode: '28901' });
    assert.equal(contract.status, 200, JSON.stringify(contract.data));
    await admin.patch(`/api/admin/solicitudes/${id}`, { status: 'adoptado', catStatus: 'adoptado' });
    // Uno adoptado a mano, sin solicitud.
    await createCat({ name: 'Sin Papeles', status: 'adoptado' });

    const list = await admin.get('/api/admin/adoptados');
    assert.equal(list.status, 200);
    const garbancita = list.data.cats.find((c) => c.name === 'Garbancita');
    assert.equal(garbancita.adopter.name, 'Lola Martín');
    assert.equal(garbancita.adopter.province, 'Madrid');
    assert.match(garbancita.adopter.contractNumber, /^A-\d{4}-\d{3}$/);
    assert.ok(garbancita.adoptedAt);
    assert.equal(list.data.cats.find((c) => c.name === 'Sin Papeles').adopter, null);
    assert.ok(list.data.cats.every((c) => c.name !== 'Luna'));

    assert.equal((await anon.get('/api/admin/adoptados')).status, 401);
  });
});
