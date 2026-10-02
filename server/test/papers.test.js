import { client, loggedIn, startServer, validApplication } from './helpers.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { db, migrations, runMigrations } from '../src/db.js';
import { nextFileNumber, today } from '../src/numbers.js';
import { adoptionConditions } from '../src/papers/agreements.js';
import { catPaperData } from '../src/papers/data.js';

// Papeles de la asociación: ficha interna de los gatos, gatos de colonia,
// casas de acogida, partes veterinarios, contrato, inventario, donaciones y
// los PDF que se sacan de todo ello.

let server;
let admin;
let helper;
const YEAR = new Date().getFullYear();

before(async () => {
  server = await startServer();
  admin = await loggedIn(server.base, 'admin');
  helper = await loggedIn(server.base, 'cuidabigotes');
});
after(() => server.close());

const newCat = async (api, body = {}) => {
  const res = await api.post('/api/admin/gatitos', { name: 'Gatito', status: 'disponible', ...body });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data.cat;
};

/** Comprueba que la respuesta es un PDF con páginas del tamaño indicado (en puntos). */
function assertPdf(res, [width, height], pages = 1) {
  assert.equal(res.status, 200, typeof res.data === 'string' ? res.data.slice(0, 200) : JSON.stringify(res.data));
  assert.match(res.headers.get('content-type'), /application\/pdf/);
  assert.ok(res.data.startsWith('%PDF-'));
  const boxes = [...res.data.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.equal(boxes.length, pages);
  for (const [w, h] of boxes) {
    assert.ok(Math.abs(w - width) < 1 && Math.abs(h - height) < 1, `página de ${w}×${h}`);
  }
}
const A4 = [595.28, 841.89];
const A4L = [841.89, 595.28];
const A5 = [419.53, 595.28];
const A5L = [595.28, 419.53];

describe('migración', () => {
  test('rehace la tabla de gatos sin perder fotos, vídeos ni solicitudes y numera las fichas', () => {
    const old = new Database(':memory:');
    old.pragma('foreign_keys = ON');
    for (const [i, sql] of migrations.slice(0, 2).entries()) {
      old.exec(sql);
      old.pragma(`user_version = ${i + 1}`);
    }
    const insert = old.prepare('INSERT INTO cats (slug, name, status, arrived_at, created_at) VALUES (?, ?, ?, ?, ?)');
    insert.run('luna', 'Luna', 'disponible', '2025-11-03', '2026-01-01 10:00:00');
    insert.run('sol', 'Sol', 'adoptado', null, '2026-02-01 10:00:00');
    insert.run('tom', 'Tom', 'borrador', '2026-01-05', '2026-03-01 10:00:00');
    insert.run('borrado', 'Borrado', 'borrador', null, '2026-04-01 10:00:00');
    old.prepare("DELETE FROM cats WHERE slug = 'borrado'").run();
    old.prepare("INSERT INTO cat_photos (cat_id, file_key, width, height) VALUES (1, 'f1', 10, 10)").run();
    old.prepare("INSERT INTO cat_videos (cat_id, file_key) VALUES (2, 'v2')").run();
    old.prepare(
      "INSERT INTO applications (cat_id, name, email, phone, municipality, province) VALUES (1, 'Ana', 'a@a.es', '600000000', 'Almendralejo', 'Badajoz')",
    ).run();

    assert.equal(runMigrations(old), migrations.length);
    assert.equal(old.pragma('foreign_keys', { simple: true }), 1);
    assert.deepEqual(old.pragma('foreign_key_check'), []);
    assert.deepEqual(
      old.prepare('SELECT slug, file_number FROM cats ORDER BY id').all(),
      [
        { slug: 'luna', file_number: '2025-001' },
        { slug: 'sol', file_number: '2026-002' },
        { slug: 'tom', file_number: '2026-001' },
      ],
    );
    assert.equal(old.prepare('SELECT COUNT(*) AS n FROM cat_photos').get().n, 1);
    assert.equal(old.prepare('SELECT COUNT(*) AS n FROM cat_videos').get().n, 1);
    assert.equal(old.prepare('SELECT cat_id FROM applications').get().cat_id, 1);
    // No se reutiliza el id del gatito borrado y las cascadas siguen funcionando.
    assert.equal(old.prepare("INSERT INTO cats (slug, name) VALUES ('nuevo', 'Nuevo')").run().lastInsertRowid, 5);
    old.prepare('DELETE FROM cats WHERE id = 1').run();
    assert.equal(old.prepare('SELECT COUNT(*) AS n FROM cat_photos').get().n, 0);
    assert.equal(old.prepare('SELECT cat_id FROM applications').get().cat_id, null);
  });
});

describe('ficha interna y gatos de colonia', () => {
  test('cada gato recibe su n.º de ficha del año y la ficha interna no sale en la web', async () => {
    const expected = nextFileNumber(YEAR);
    const cat = await newCat(helper, {
      name: 'Pistacho',
      record: { intakePlace: 'Parque de la Piedad', microchipNumber: '941000024680135', colonyMember: 'no' },
    });
    assert.equal(cat.record.fileNumber, expected);
    assert.equal(cat.record.intakePlace, 'Parque de la Piedad');
    const second = await newCat(helper, { name: 'Anís', arrivedAt: '2024-05-02' });
    assert.match(second.record.fileNumber, /^2024-\d{3}$/);

    const pub = await client(server.base).get(`/api/gatitos/${cat.slug}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.data.cat.record, undefined);
    assert.ok(!JSON.stringify(pub.data).includes('941000024680135'));
  });

  test('el n.º de ficha no se repite y se conserva si llega vacío', async () => {
    const a = await newCat(helper, { name: 'Uno' });
    const b = await newCat(helper, { name: 'Dos' });
    const dup = await helper.put(`/api/admin/gatitos/${b.id}`, { ...b, record: { ...b.record, fileNumber: a.record.fileNumber } });
    assert.equal(dup.status, 400);
    assert.ok(dup.data.fields['record.fileNumber']);
    const kept = await helper.put(`/api/admin/gatitos/${b.id}`, { ...b, record: { ...b.record, fileNumber: '' } });
    assert.equal(kept.data.cat.record.fileNumber, b.record.fileNumber);
    // Sin ficha interna en la petición, se queda la que había.
    const { record, ...withoutRecord } = b;
    const same = await helper.put(`/api/admin/gatitos/${b.id}`, { ...withoutRecord, record: undefined });
    assert.deepEqual(same.data.cat.record, record);
  });

  test('un gato devuelto a su colonia queda registrado pero nunca sale en la web', async () => {
    const before = (await client(server.base).get('/api/sitio')).data;
    const cat = await newCat(helper, {
      name: 'Tuerta',
      sex: 'hembra',
      status: 'colonia',
      record: { colonyMember: 'si', colonyName: 'Colonia del mercado', colonyCaretaker: 'Paco', earTipped: 'si' },
    });
    assert.equal(cat.status, 'colonia');
    assert.equal(cat.record.returnedAt, today());
    const anon = client(server.base);
    assert.equal((await anon.get(`/api/gatitos/${cat.slug}`)).status, 404);
    assert.ok(!(await anon.get('/api/gatitos')).data.cats.some((c) => c.slug === cat.slug));
    assert.ok(!(await anon.get('/sitemap.xml')).data.includes(cat.slug));
    assert.equal((await anon.get('/api/sitio')).data.stats?.rescued, before.stats?.rescued);

    const paper = catPaperData(cat.id);
    assert.equal(paper.situation.colony, true);
    assert.equal(paper.outcome.person, 'Paco');

    // El cambio rápido de estado también apunta la fecha de vuelta.
    const moved = await helper.patch(`/api/admin/gatitos/${cat.id}/estado`, { status: 'borrador' });
    assert.equal(moved.data.cat.record.returnedAt, '');
    const back = await helper.patch(`/api/admin/gatitos/${cat.id}/estado`, { status: 'colonia' });
    assert.equal(back.data.cat.record.returnedAt, today());
    assert.equal((await helper.get('/api/admin/resumen')).data.cats.colonia >= 1, true);
  });
});

describe('casas de acogida', () => {
  test('alta, asignación a un gato y borrado solo para bigotes mayores', async () => {
    const res = await helper.post('/api/admin/acogidas', {
      name: 'Lucía Fernández',
      dni: '12345678Z',
      phone: '612 345 678',
      email: 'lucia@example.com',
      address: 'C/ Mérida 12, Almendralejo',
    });
    assert.equal(res.status, 201);
    const foster = res.data.foster;
    assert.equal((await helper.post('/api/admin/acogidas', { name: '' })).status, 400);
    assert.equal((await helper.post('/api/admin/acogidas', { name: 'X', email: 'no-es-email' })).status, 400);

    const cat = await newCat(helper, { name: 'Acogido', record: { fosterId: foster.id } });
    assert.equal(cat.record.fosterId, foster.id);
    assert.equal(cat.record.fosterSince, today());
    const missing = await helper.post('/api/admin/gatitos', { name: 'Huérfano', record: { fosterId: 99999 } });
    assert.equal(missing.status, 400);

    const list = (await helper.get('/api/admin/acogidas')).data.fosters;
    assert.deepEqual(
      list.find((f) => f.id === foster.id).cats.map((c) => c.name),
      ['Acogido'],
    );

    assert.equal((await helper.delete(`/api/admin/acogidas/${foster.id}`)).status, 403);
    assert.equal((await admin.delete(`/api/admin/acogidas/${foster.id}`)).status, 200);
    const after = (await helper.get(`/api/admin/gatitos/${cat.id}`)).data.cat;
    assert.equal(after.record.fosterId, null);
    assert.equal(after.record.fosterSince, '');
  });
});

describe('historial y partes veterinarios', () => {
  test('cada parte tiene su número del año y luego se completa con lo que hizo la clínica', async () => {
    const cat = await newCat(helper, { name: 'Paciente' });
    const first = await helper.post(`/api/admin/gatitos/${cat.id}/veterinario`, { date: today(), carrierName: 'Lucía', carrierPhone: '612 345 678' });
    assert.equal(first.status, 201);
    assert.match(first.data.visit.number, new RegExp(`^V-${YEAR}-\\d{3}$`));
    const second = await helper.post(`/api/admin/gatitos/${cat.id}/veterinario`, { date: today() });
    const n = (visit) => Number(visit.number.slice(-3));
    assert.equal(n(second.data.visit), n(first.data.visit) + 1);

    const done = await helper.put(`/api/admin/gatitos/${cat.id}/veterinario/${first.data.visit.id}`, {
      ...first.data.visit,
      clinic: 'Clínica San Antón',
      diagnosis: 'Conjuntivitis leve.',
      nextCheck: today(),
      amount: '35,50',
    });
    assert.equal(done.status, 200);
    assert.equal(done.data.visit.amount, 35.5);
    const bad = await helper.put(`/api/admin/gatitos/${cat.id}/veterinario/${first.data.visit.id}`, { ...first.data.visit, amount: 'mucho' });
    assert.equal(bad.status, 400);
    assert.ok(bad.data.fields.amount);

    const note = await helper.post(`/api/admin/gatitos/${cat.id}/historial`, { date: today(), body: 'Ya juega con la caña.' });
    assert.equal(note.status, 201);
    assert.equal(note.data.entries[0].author, helper.user.name);
    assert.equal((await helper.post(`/api/admin/gatitos/${cat.id}/historial`, { date: today(), body: '' })).status, 400);

    const paper = catPaperData(cat.id);
    assert.equal(paper.hasVetVisits, true);
    assert.equal(paper.vet.clinic, 'Clínica San Antón');
    assert.equal(paper.history.length, 3);
    assert.ok(paper.history.some((h) => h.text.includes('Conjuntivitis leve. Próxima revisión')));

    // Las revisiones cercanas salen en los avisos del resumen.
    const alerts = (await helper.get('/api/admin/resumen')).data.alerts;
    assert.ok(alerts.checks.some((c) => c.catId === cat.id));

    assert.equal((await helper.delete(`/api/admin/gatitos/${cat.id}/veterinario/${second.data.visit.id}`)).status, 200);
    assert.equal((await helper.get(`/api/admin/gatitos/${cat.id}/historial`)).data.visits.length, 1);
    assert.equal((await helper.get('/api/admin/gatitos/99999/historial')).status, 404);
  });
});

describe('contrato de adopción', () => {
  test('se completan los datos que faltan y se reserva el número la primera vez', async () => {
    const cat = await newCat(helper, { name: 'Adoptable' });
    const anon = client(server.base);
    assert.equal((await anon.post('/api/solicitudes', validApplication({ catSlug: cat.slug }))).status, 201);
    const app = (await helper.get('/api/admin/solicitudes')).data.applications.find((a) => a.catId === cat.id);
    assert.equal((await helper.get(`/api/admin/solicitudes/${app.id}`)).data.application.contract.number, '');

    const bad = await helper.put(`/api/admin/solicitudes/${app.id}/contrato`, { postalCode: '123' });
    assert.equal(bad.status, 400);
    assert.ok(bad.data.fields.postalCode);

    const res = await helper.put(`/api/admin/solicitudes/${app.id}/contrato`, {
      dni: '87654321X',
      birthDate: '1990-03-21',
      address: 'Avda. de la Constitución 45',
      postalCode: '06200',
      altContactName: 'José',
    });
    assert.equal(res.status, 200);
    const { contract, notes } = res.data.application;
    assert.match(contract.number, new RegExp(`^A-${YEAR}-\\d{3}$`));
    assert.equal(contract.date, today());
    assert.equal(contract.dni, '87654321X');
    assert.ok(notes.some((note) => note.body.includes(contract.number)));

    const again = await helper.put(`/api/admin/solicitudes/${app.id}/contrato`, { dni: '87654321X', address: 'Otra calle 1' });
    assert.equal(again.data.application.contract.number, contract.number);
    assert.equal(again.data.application.contract.address, 'Otra calle 1');
  });

  test('las condiciones piden esterilizar solo si se entrega sin esterilizar, y hablan de ella o de él', () => {
    const female = adoptionConditions({ sex: 'hembra', sterilized: false });
    assert.ok(female.some((c) => c.includes('esterilizarla')));
    assert.ok(female.some((c) => c.includes('de ella') && c.includes('devolverla')));
    assert.ok(!adoptionConditions({ sex: 'macho', sterilized: true }).some((c) => c.includes('esterilizar')));
  });
});

describe('inventario', () => {
  test('medicación con caducidad, avisos y cantidades que no bajan de cero', async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    const res = await helper.post('/api/admin/inventario', {
      kind: 'medicacion',
      name: 'Tobrex colirio',
      quantity: '1',
      unit: 'frasco',
      expiresOn: today(soon),
      instructions: '1 gota cada 8 h',
    });
    assert.equal(res.status, 201);
    const item = res.data.item;
    assert.equal(item.category, '');
    assert.equal((await helper.post('/api/admin/inventario', { kind: 'medicacion', name: '' })).status, 400);
    assert.equal((await helper.post('/api/admin/inventario', { kind: 'medicacion', name: 'X', quantity: '-3' })).status, 400);

    const down = await helper.patch(`/api/admin/inventario/${item.id}/cantidad`, { delta: -5 });
    assert.equal(down.data.item.quantity, 0);

    const food = await helper.post('/api/admin/inventario', { kind: 'general', name: 'Pienso kitten', category: 'comida', quantity: '1,5', minQuantity: '2' });
    assert.equal(food.data.item.quantity, 1.5);

    const { alerts } = (await helper.get('/api/admin/resumen')).data;
    assert.ok(alerts.expiring.some((i) => i.id === item.id));
    assert.ok(alerts.low.some((i) => i.id === food.data.item.id));
    const general = (await helper.get('/api/admin/inventario?tipo=general')).data;
    assert.ok(general.items.some((i) => i.name === 'Pienso kitten'));
    assert.equal((await helper.delete(`/api/admin/inventario/${item.id}`)).status, 200);
  });
});

describe('donaciones', () => {
  test('dinero con importe, material con descripción y totales del año', async () => {
    const empty = await helper.post('/api/admin/donaciones', { date: today(), kind: 'dinero' });
    assert.equal(empty.status, 400);
    assert.ok(empty.data.fields.amount);
    assert.equal((await helper.post('/api/admin/donaciones', { date: today(), kind: 'material' })).status, 400);
    const future = new Date();
    future.setDate(future.getDate() + 3);
    assert.equal((await helper.post('/api/admin/donaciones', { date: today(future), kind: 'dinero', amount: 5 })).status, 400);

    const money = await helper.post('/api/admin/donaciones', { date: today(), kind: 'dinero', amount: '20,50', method: 'bizum', donorName: 'Juan' });
    assert.equal(money.status, 201);
    assert.equal(money.data.donation.amount, 20.5);
    const gift = await helper.post('/api/admin/donaciones', { date: today(), kind: 'material', description: '3 sacos de pienso', amount: '99' });
    assert.equal(gift.data.donation.amount, null);

    const year = (await helper.get('/api/admin/donaciones')).data;
    assert.equal(year.year, YEAR);
    assert.equal(year.totals.money, 20.5);
    assert.equal(year.totals.materialCount, 1);

    assert.equal((await helper.delete(`/api/admin/donaciones/${money.data.donation.id}`)).status, 403);
    assert.equal((await admin.delete(`/api/admin/donaciones/${money.data.donation.id}`)).status, 200);
  });
});

describe('papeles en PDF', () => {
  let cat;
  let visit;
  let application;
  let foster;

  before(async () => {
    foster = (await helper.post('/api/admin/acogidas', { name: 'Marta Acogida', dni: '11111111H' })).data.foster;
    cat = await newCat(helper, { name: 'Papelito', sex: 'hembra', record: { fosterId: foster.id, pending: 'Segunda vacuna' } });
    visit = (await helper.post(`/api/admin/gatitos/${cat.id}/veterinario`, { date: today(), carrierName: 'Marta' })).data.visit;
    await client(server.base).post('/api/solicitudes', validApplication({ catSlug: cat.slug }));
    application = (await helper.get('/api/admin/solicitudes')).data.applications.find((a) => a.catId === cat.id);
    await helper.put(`/api/admin/solicitudes/${application.id}/contrato`, { dni: '87654321X' });
    for (let i = 0; i < 40; i += 1) {
      db.prepare('INSERT INTO cat_log (cat_id, date, body) VALUES (?, ?, ?)').run(cat.id, today(), `Nota ${i} con un poco de texto para llenar la tabla.`);
    }
  });

  test('cada papel sale en su tamaño, relleno y en blanco', async () => {
    assertPdf(await helper.get(`/api/papeles/gatito/${cat.id}/ficha`), A4);
    // 40 notas no caben en una hoja: la ficha de seguimiento sigue en otras.
    const followUp = await helper.get(`/api/papeles/gatito/${cat.id}/seguimiento`);
    assert.ok([...followUp.data.matchAll(/\/MediaBox/g)].length >= 3);
    assertPdf(await helper.get(`/api/papeles/gatito/${cat.id}/acogida`), A5);
    assertPdf(await helper.get(`/api/papeles/parte/${visit.id}`), A5L);
    assertPdf(await helper.get(`/api/papeles/contrato/${application.id}`), A4);
    assertPdf(await helper.get(`/api/papeles/confidencialidad/acogida/${foster.id}`), A4);
    assertPdf(await helper.get('/api/papeles/medicacion'), A4);
    assertPdf(await helper.get('/api/papeles/inventario'), A4);
    assertPdf(await helper.get(`/api/papeles/donaciones?desde=${YEAR}-01-01&hasta=${YEAR}-12-31`), A4);
    for (const [type, size] of [
      ['ficha', A4],
      ['seguimiento', A5],
      ['acogida', A5],
      ['parte', A5L],
      ['contrato', A4],
      ['confidencialidad', A4],
      ['medicacion', A4],
      ['inventario', A4],
      ['donaciones', A4],
    ]) {
      assertPdf(await helper.get(`/api/papeles/en-blanco/${type}`), size);
    }
    assert.equal((await helper.get('/api/papeles/en-blanco/otra-cosa')).status, 404);
    assert.equal((await helper.get('/api/papeles/gatito/99999/ficha')).status, 404);
  });

  test('los A5 salen dos por folio A4 para imprimir en casa', async () => {
    assertPdf(await helper.get(`/api/papeles/gatito/${cat.id}/acogida?hoja=a4`), A4L);
    assertPdf(await helper.get(`/api/papeles/parte/${visit.id}?hoja=a4`), A4);
    // En A4 ya no se juntan.
    assertPdf(await helper.get(`/api/papeles/gatito/${cat.id}/ficha?hoja=a4`), A4);
  });

  test('se abren con la sesión o con el permiso de media hora, y no de otra forma', async () => {
    const anon = client(server.base);
    const denied = await anon.get(`/api/papeles/gatito/${cat.id}/ficha`);
    assert.equal(denied.status, 401);
    assert.match(denied.headers.get('content-type'), /text\/html/);
    assert.match(denied.data, /Este enlace ha caducado/);

    const { token, expiresAt } = (await helper.post('/api/admin/papeles/permiso')).data;
    assert.ok(Date.parse(expiresAt) > Date.now() + 25 * 60 * 1000);
    assertPdf(await anon.get(`/api/papeles/gatito/${cat.id}/ficha?t=${token}`), A4);
    assert.equal((await anon.get(`/api/papeles/gatito/${cat.id}/ficha?t=${token}x`)).status, 401);
    // El permiso no sirve para el resto del panel.
    assert.equal((await anon.get(`/api/admin/gatitos?t=${token}`)).status, 401);

    // Si desactivan a la persona, su permiso deja de valer.
    const temp = await loggedIn(server.base, 'cuidabigotes');
    const tempToken = (await temp.post('/api/admin/papeles/permiso')).data.token;
    db.prepare('UPDATE users SET active = 0, session_version = session_version + 1 WHERE id = ?').run(temp.user.id);
    assert.equal((await anon.get(`/api/papeles/medicacion?t=${tempToken}`)).status, 401);
  });

  test('el compromiso de alguien del equipo lo saca esa persona o un bigote mayor', async () => {
    assertPdf(await helper.get(`/api/papeles/confidencialidad/equipo/${helper.user.id}`), A4);
    assert.equal((await helper.get(`/api/papeles/confidencialidad/equipo/${admin.user.id}`)).status, 403);
    assertPdf(await admin.get(`/api/papeles/confidencialidad/equipo/${helper.user.id}`), A4);
    assert.equal((await admin.get('/api/papeles/confidencialidad/otra/1')).status, 404);
  });
});
