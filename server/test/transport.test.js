import { client, loggedIn, startServer, validApplication } from './helpers.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrations, runMigrations } from '../src/db.js';
import { getContent } from '../src/content.js';
import { EXTREMADURA, PROVINCES } from '../src/forms.js';
import * as clientForms from '../../client/src/lib/forms.js';

// Transporte solidario: gente que viaja a menudo a otra ciudad y permite dar
// en adopción fuera de Extremadura. Y los datos legales de ejemplo.

let server;
let admin;
let helper;
let anon;

before(async () => {
  server = await startServer();
  admin = await loggedIn(server.base, 'admin');
  helper = await loggedIn(server.base, 'cuidabigotes');
  anon = client(server.base);
});
after(() => server.close());

const person = (overrides = {}) => ({
  name: 'Lola Viajera',
  email: 'lola@ejemplo.es',
  phone: '611 222 333',
  origin: 'Almendralejo',
  destinations: [{ city: 'Madrid', province: 'Madrid' }],
  frequency: 'semanal',
  notes: 'Voy los viernes en coche.',
  adult: true,
  privacy: true,
  ...overrides,
});

describe('transporte solidario', () => {
  test('las provincias son las mismas en la web y en el servidor', () => {
    assert.deepEqual(clientForms.PROVINCES, PROVINCES);
    assert.deepEqual(clientForms.EXTREMADURA, EXTREMADURA);
    assert.equal(PROVINCES.length, 52);
  });

  test('cualquiera se apunta desde la web con sus destinos', async () => {
    const empty = await anon.post('/api/transporte', person({ destinations: [] }));
    assert.equal(empty.status, 400);
    assert.ok(empty.data.fields.destinations);
    const bad = await anon.post('/api/transporte', person({ destinations: [{ city: 'Narnia', province: 'Narnia' }] }));
    assert.equal(bad.status, 400);
    assert.ok(bad.data.fields['destinations.0.province']);
    assert.equal((await anon.post('/api/transporte', person({ frequency: 'nunca' }))).status, 400);
    assert.equal((await anon.post('/api/transporte', person({ privacy: false }))).status, 400);
    // El campo trampa finge éxito sin guardar nada.
    assert.equal((await anon.post('/api/transporte', person({ name: 'Bot', website: 'spam' }))).status, 201);

    assert.equal((await anon.post('/api/transporte', person())).status, 201);
    const { items, counts } = (await helper.get('/api/admin/transporte')).data;
    assert.equal(items.length, 1);
    assert.equal(counts.nuevo, 1);
    assert.deepEqual(items[0].destinations, [{ city: 'Madrid', province: 'Madrid' }]);
    assert.equal((await helper.get('/api/admin/resumen')).data.transport.new, 1);
  });

  test('cada solicitud de fuera de Extremadura muestra quién viaja a su provincia', async () => {
    await anon.post(
      '/api/transporte',
      person({
        name: 'Pepe Archivado',
        email: 'pepe@ejemplo.es',
        destinations: [
          { city: 'Getafe', province: 'Madrid' },
          { city: 'Sevilla', province: 'Sevilla' },
        ],
      }),
    );
    await anon.post('/api/transporte', person({ name: 'Ana Mérida', email: 'ana@ejemplo.es', destinations: [{ city: 'Mérida', province: 'Badajoz' }] }));
    const items = (await helper.get('/api/admin/transporte')).data.items;
    const lola = items.find((t) => t.name === 'Lola Viajera');
    const pepe = items.find((t) => t.name === 'Pepe Archivado');
    assert.equal((await helper.patch(`/api/admin/transporte/${lola.id}`, { status: 'activo' })).status, 200);

    assert.equal((await anon.post('/api/solicitudes', validApplication({ name: 'Familia Madrid', province: 'Madrid', municipality: 'Getafe' }))).status, 201);
    assert.equal((await anon.post('/api/solicitudes', validApplication({ name: 'Familia Soria', province: 'Soria', municipality: 'Soria' }))).status, 201);
    assert.equal((await anon.post('/api/solicitudes', validApplication({ name: 'Familia Badajoz' }))).status, 201);

    const list = (await helper.get('/api/admin/solicitudes')).data.applications;
    const madrid = list.find((a) => a.name === 'Familia Madrid');
    assert.equal(madrid.outsideExtremadura, true);
    assert.equal(madrid.transportCount, 2);
    assert.equal(list.find((a) => a.name === 'Familia Soria').transportCount, 0);
    const local = list.find((a) => a.name === 'Familia Badajoz');
    assert.equal(local.outsideExtremadura, false);
    assert.equal(local.transportCount, undefined);

    const detail = (await helper.get(`/api/admin/solicitudes/${madrid.id}`)).data.application;
    // Primero quien ya está confirmado, con las ciudades de esa provincia.
    assert.deepEqual(
      detail.transport.map((t) => [t.name, t.cities]),
      [
        ['Lola Viajera', ['Madrid']],
        ['Pepe Archivado', ['Getafe']],
      ],
    );
    assert.equal((await helper.get(`/api/admin/solicitudes/${local.id}`)).data.application.transport, null);

    // Quien se archiva deja de salir.
    await helper.patch(`/api/admin/transporte/${pepe.id}`, { status: 'archivado' });
    const after = (await helper.get(`/api/admin/solicitudes/${madrid.id}`)).data.application;
    assert.deepEqual(after.transport.map((t) => t.name), ['Lola Viajera']);
  });

  test('compromiso de confidencialidad y borrado solo para bigotes mayores', async () => {
    const lola = (await helper.get('/api/admin/transporte')).data.items.find((t) => t.name === 'Lola Viajera');
    const pdf = await helper.get(`/api/papeles/confidencialidad/transporte/${lola.id}`);
    assert.equal(pdf.status, 200);
    assert.ok(pdf.data.startsWith('%PDF-'));
    assert.equal((await helper.delete(`/api/admin/transporte/${lola.id}`)).status, 403);
    assert.equal((await admin.delete(`/api/admin/transporte/${lola.id}`)).status, 200);
  });
});

describe('datos legales de ejemplo', () => {
  test('vienen puestos para ver los papeles completos', () => {
    const legal = getContent('legal');
    assert.equal(legal.cif, 'G12345678');
    assert.match(legal.registry, /1234567/);
  });

  test('la migración rellena solo los que estaban vacíos', () => {
    const old = new Database(':memory:');
    for (const [i, entry] of migrations.slice(0, 3).entries()) {
      old.exec(typeof entry === 'string' ? entry : entry.sql);
      old.pragma(`user_version = ${i + 1}`);
    }
    old.prepare("INSERT INTO settings (key, value) VALUES ('legal', ?)").run(
      JSON.stringify({ holder: 'Bigotes', cif: '', registry: 'Registro real n.º 9', address: '', email: '' }),
    );
    runMigrations(old);
    const legal = JSON.parse(old.prepare("SELECT value FROM settings WHERE key = 'legal'").get().value);
    assert.equal(legal.cif, 'G12345678');
    assert.equal(legal.registry, 'Registro real n.º 9');
    assert.match(legal.address, /Almendralejo/);
    assert.equal(legal.email, 'hola@bigotes.example');
  });
});
