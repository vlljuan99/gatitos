import { client, loggedIn, startServer, validApplication } from './helpers.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db.js';

let server;
let api;
let admin;

before(async () => {
  server = await startServer();
  api = client(server.base);
  admin = await loggedIn(server.base, 'admin');
});
after(() => server.close());

async function createCat(body) {
  const res = await admin.post('/api/admin/gatitos', { name: 'Luna', status: 'disponible', ...body });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data.cat;
}

describe('portada', () => {
  test('devuelve los textos por defecto y los contadores', async () => {
    await createCat({ name: 'Contador', status: 'adoptado' });
    const res = await api.get('/api/sitio');
    assert.equal(res.status, 200);
    assert.match(res.data.content.home.heroTitle, /hogar/);
    assert.ok(res.data.content.faq.items.length > 0);
    assert.ok(res.data.stats.rescued >= 1);
    assert.ok(res.data.stats.adoptedThisYear >= 1);
  });

  test('los contadores suman los rescatados antes de la web', async () => {
    const before = (await api.get('/api/sitio')).data.stats.rescued;
    const home = (await admin.get('/api/admin/contenidos')).data.content.home;
    await admin.put('/api/admin/contenidos/home', { ...home, rescuedBase: 120 });
    const res = await api.get('/api/sitio');
    assert.equal(res.data.stats.rescued, before + 120);
  });
});

describe('gatitos públicos', () => {
  test('los borradores no se ven y los reservados sí', async () => {
    const draft = await createCat({ name: 'Secreto', status: 'borrador' });
    const reserved = await createCat({ name: 'Nube', status: 'reservado' });
    const list = await api.get('/api/gatitos');
    const slugs = list.data.cats.map((c) => c.slug);
    assert.ok(!slugs.includes(draft.slug));
    assert.ok(slugs.includes(reserved.slug));
    assert.equal((await api.get(`/api/gatitos/${draft.slug}`)).status, 404);
    assert.equal(list.data.cats[0].likes, undefined, 'los «me encanta» no se publican');
  });

  test('«me encanta» suma uno y solo vale para gatitos que buscan hogar', async () => {
    const cat = await createCat({ name: 'Canelo' });
    assert.equal((await api.post(`/api/gatitos/${cat.slug}/me-encanta`)).status, 200);
    assert.equal((await api.post(`/api/gatitos/${cat.slug}/me-encanta`)).status, 200);
    assert.equal(db.prepare('SELECT likes FROM cats WHERE id = ?').get(cat.id).likes, 2);

    const adopted = await createCat({ name: 'Garbanzo', status: 'adoptado' });
    assert.equal((await api.post(`/api/gatitos/${adopted.slug}/me-encanta`)).status, 404);
  });

  test('finales felices lista solo adoptados', async () => {
    const res = await api.get('/api/finales-felices');
    assert.ok(res.data.cats.length > 0);
    assert.ok(res.data.cats.every((c) => c.status === 'adoptado' && c.adoptedAt));
  });
});

describe('solicitud de adopción', () => {
  test('se guarda con el gatito elegido y las respuestas', async () => {
    const cat = await createCat({ name: 'Tofu' });
    const res = await api.post('/api/solicitudes', validApplication({ catSlug: cat.slug }));
    assert.equal(res.status, 201, JSON.stringify(res.data));
    const row = db.prepare('SELECT * FROM applications ORDER BY id DESC LIMIT 1').get();
    assert.equal(row.cat_id, cat.id);
    assert.equal(row.cat_name, 'Tofu');
    assert.equal(row.email, 'ana@ejemplo.es');
    assert.equal(row.status, 'nueva');
    const answers = JSON.parse(row.answers);
    assert.equal(answers.windowsSafe, 'si');
    assert.equal(answers.name, undefined, 'los datos de contacto van en columnas propias');
  });

  test('solo se admite Extremadura', async () => {
    const res = await api.post('/api/solicitudes', validApplication({ province: 'Madrid' }));
    assert.equal(res.status, 400);
    assert.match(res.data.fields.province, /Extremadura/);
  });

  test('de alquiler hay que decir si se permiten animales', async () => {
    const res = await api.post('/api/solicitudes', validApplication({ tenure: 'alquiler' }));
    assert.equal(res.status, 400);
    assert.ok(res.data.fields.petsAllowed);
    const ok = await api.post('/api/solicitudes', validApplication({ tenure: 'alquiler', petsAllowed: 'si' }));
    assert.equal(ok.status, 201);
  });

  test('exige consentimiento, mayoría de edad y compromisos', async () => {
    const res = await api.post(
      '/api/solicitudes',
      validApplication({ privacy: false, adult: undefined, commitVet: false }),
    );
    assert.equal(res.status, 400);
    assert.ok(res.data.fields.privacy);
    assert.ok(res.data.fields.adult);
    assert.ok(res.data.fields.commitVet);
  });

  test('un gatito adoptado ya no se puede solicitar', async () => {
    const cat = await createCat({ name: 'Chispa', status: 'adoptado' });
    const res = await api.post('/api/solicitudes', validApplication({ catSlug: cat.slug }));
    assert.equal(res.status, 400);
    assert.ok(res.data.fields.catSlug);
  });

  test('el campo trampa finge éxito y no guarda nada', async () => {
    const count = () => db.prepare('SELECT COUNT(*) AS n FROM applications').get().n;
    const before = count();
    const res = await api.post('/api/solicitudes', validApplication({ website: 'http://spam.example' }));
    assert.equal(res.status, 201);
    assert.equal(count(), before);
  });
});

describe('contacto y voluntariado', () => {
  test('guarda un mensaje de contacto', async () => {
    const res = await api.post('/api/mensajes', {
      name: 'Pepe',
      email: 'pepe@ejemplo.es',
      body: '¿Puedo ir a conocer a Luna?',
      privacy: true,
    });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM messages WHERE name = 'Pepe'").get().n, 1);
  });

  test('voluntariado exige al menos una forma de ayudar', async () => {
    const base = {
      name: 'Lucía',
      email: 'lucia@ejemplo.es',
      phone: '+34 611 222 333',
      municipality: 'Almendralejo',
      adult: true,
      privacy: true,
    };
    const bad = await api.post('/api/voluntariado', { ...base, areas: [] });
    assert.equal(bad.status, 400);
    assert.ok(bad.data.fields.areas);
    const ok = await api.post('/api/voluntariado', { ...base, areas: ['fotos', 'redes'] });
    assert.equal(ok.status, 201);
  });

  test('frena el envío masivo desde la misma IP', async () => {
    const fresh = await startServer();
    const anon = client(fresh.base);
    const body = { name: 'Bot', email: 'bot@ejemplo.es', body: 'hola', privacy: true };
    let last;
    for (let i = 0; i < 21; i += 1) last = await anon.post('/api/mensajes', body);
    assert.equal(last.status, 429);
    await fresh.close();
  });
});

describe('seguridad', () => {
  test('rechaza peticiones que cambian datos desde otra web', async () => {
    const res = await api.post(
      '/api/mensajes',
      { name: 'X', email: 'x@ejemplo.es', body: 'hola', privacy: true },
      { origin: 'https://malvado.example' },
    );
    assert.equal(res.status, 403);
  });

  test('envía cabeceras de seguridad', async () => {
    const res = await api.get('/api/health');
    assert.equal(res.data.ok, true);
    assert.equal(res.data.database.migration, 1);
    assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});
