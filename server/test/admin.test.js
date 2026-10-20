import { client, loggedIn, startServer, validApplication } from './helpers.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { db } from '../src/db.js';
import { CAT_PHOTOS_DIR } from '../src/config.js';

let server;
let admin;
let helper;

before(async () => {
  server = await startServer();
  admin = await loggedIn(server.base, 'admin');
  helper = await loggedIn(server.base, 'cuidabigotes');
});
after(() => server.close());

async function jpegWithGps() {
  return sharp({ create: { width: 900, height: 700, channels: 3, background: '#f4a259' } })
    .withExif({
      IFD0: { Make: 'Movil', Model: 'Gatofono' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '38/1 41/1 0/1',
        GPSLongitudeRef: 'W',
        GPSLongitude: '6/1 24/1 0/1',
      },
    })
    .jpeg()
    .toBuffer();
}

describe('acceso', () => {
  test('sin sesión no se entra al panel', async () => {
    const anon = client(server.base);
    assert.equal((await anon.get('/api/admin/resumen')).status, 401);
    assert.equal((await anon.get('/api/admin/gatitos')).status, 401);
  });

  test('login incorrecto', async () => {
    const anon = client(server.base);
    const res = await anon.post('/api/auth/login', { email: admin.user.email, password: 'no-es-esta' });
    assert.equal(res.status, 401);
  });

  test('cuidabigotes no gestiona el equipo ni los datos legales, pero sí los textos', async () => {
    assert.equal((await helper.get('/api/admin/equipo')).status, 403);
    const content = (await helper.get('/api/admin/contenidos')).data;
    assert.deepEqual(content.adminOnly, ['legal']);
    assert.equal((await helper.put('/api/admin/contenidos/legal', content.content.legal)).status, 403);
    const faq = { items: [{ q: '¿Tenéis gatitos?', a: '¡Muchísimos!' }] };
    const res = await helper.put('/api/admin/contenidos/faq', faq);
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.value.items, faq.items);
  });

  test('valida los textos antes de guardarlos', async () => {
    const res = await admin.put('/api/admin/contenidos/contact', {
      email: 'esto-no-es-un-email',
      phone: '',
      whatsapp: '',
      instagram: '',
      facebook: '',
      address: '',
      hours: '',
    });
    assert.equal(res.status, 400);
    assert.ok(res.data.fields.email);
  });
});

describe('enlaces de la web', () => {
  // La web usa estos campos como href: tienen que ser direcciones absolutas.
  test('los enlaces de donaciones se completan y se validan', async () => {
    const base = (await admin.get('/api/admin/contenidos')).data.content.donations;
    const ok = await admin.put('/api/admin/contenidos/donations', {
      ...base,
      paypal: 'paypal.me/bigotes',
      teaming: 'https://www.teaming.net/bigotes',
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.value.paypal, 'https://paypal.me/bigotes');
    assert.equal(ok.data.value.teaming, 'https://www.teaming.net/bigotes');

    for (const bad of ['javascript:alert(1)', 'hola', 'mailto:a@b.es']) {
      const res = await admin.put('/api/admin/contenidos/donations', { ...base, paypal: bad });
      assert.equal(res.status, 400, bad);
      assert.ok(res.data.fields.paypal, bad);
    }
  });

  test('facebook como enlace e instagram como usuario', async () => {
    const base = (await admin.get('/api/admin/contenidos')).data.content.contact;
    for (const [instagram, expected] of [
      ['@bigotes_almendralejo', 'bigotes_almendralejo'],
      ['https://www.instagram.com/bigotes.gatos/', 'bigotes.gatos'],
      ['instagram.com/bigotes', 'bigotes'],
    ]) {
      const res = await admin.put('/api/admin/contenidos/contact', { ...base, instagram, facebook: 'facebook.com/bigotes' });
      assert.equal(res.status, 200, JSON.stringify(res.data));
      assert.equal(res.data.value.instagram, expected);
      assert.equal(res.data.value.facebook, 'https://facebook.com/bigotes');
    }
    const bad = await admin.put('/api/admin/contenidos/contact', { ...base, instagram: 'no vale esto' });
    assert.equal(bad.status, 400);
    assert.ok(bad.data.fields.instagram);
  });
});

describe('gatitos', () => {
  test('alta, edición y cambio rápido de estado', async () => {
    const created = await helper.post('/api/admin/gatitos', {
      name: 'Luna Lunera',
      sex: 'hembra',
      birthDate: '2026-05',
      personality: ['mimoso', 'mimoso', 'juguetón'],
      goodWith: { kids: 'si' },
      health: { vaccinated: true },
    });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    const cat = created.data.cat;
    assert.equal(cat.slug, 'luna-lunera');
    assert.equal(cat.status, 'borrador');
    assert.deepEqual(cat.personality, ['mimoso', 'juguetón']);
    assert.equal(cat.goodWith.kids, 'si');
    assert.equal(cat.goodWith.dogs, 'desconocido');
    assert.equal(cat.health.vaccinated, true);
    assert.equal(cat.health.fivFelv, 'pendiente');

    const renamed = await helper.put(`/api/admin/gatitos/${cat.id}`, { ...cat, name: 'Luna', status: 'disponible' });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.data));
    assert.equal(renamed.data.cat.slug, 'luna-lunera', 'el enlace no cambia al renombrar');

    const adopted = await helper.patch(`/api/admin/gatitos/${cat.id}/estado`, { status: 'adoptado' });
    assert.equal(adopted.data.cat.status, 'adoptado');
    assert.match(adopted.data.cat.adoptedAt, /^\d{4}-\d{2}-\d{2}$/);

    const back = await helper.patch(`/api/admin/gatitos/${cat.id}/estado`, { status: 'disponible' });
    assert.equal(back.data.cat.adoptedAt, null);
  });

  test('slugs únicos y sin acentos', async () => {
    const a = await admin.post('/api/admin/gatitos', { name: 'Bigotín Ñoño' });
    const b = await admin.post('/api/admin/gatitos', { name: 'Bigotín Ñoño' });
    assert.equal(a.data.cat.slug, 'bigotin-nono');
    assert.equal(b.data.cat.slug, 'bigotin-nono-2');
  });

  test('no admite fechas de nacimiento futuras', async () => {
    const res = await admin.post('/api/admin/gatitos', { name: 'Futuro', birthDate: '2999-01' });
    assert.equal(res.status, 400);
    assert.ok(res.data.fields.birthDate);
  });

  test('solo la administración borra gatitos', async () => {
    const cat = (await helper.post('/api/admin/gatitos', { name: 'Borrable' })).data.cat;
    assert.equal((await helper.delete(`/api/admin/gatitos/${cat.id}`)).status, 403);
    assert.equal((await admin.delete(`/api/admin/gatitos/${cat.id}`)).status, 200);
    assert.equal((await admin.get(`/api/admin/gatitos/${cat.id}`)).status, 404);
  });
});

describe('fotos', () => {
  test('se suben sin datos GPS, se ordenan y se borran', async () => {
    const cat = (await helper.post('/api/admin/gatitos', { name: 'Fotogénica' })).data.cat;
    const original = await jpegWithGps();
    assert.ok((await sharp(original).metadata()).exif, 'la foto de prueba lleva EXIF');

    const form = new FormData();
    form.append('fotos', new Blob([original], { type: 'image/jpeg' }), 'movil.jpg');
    form.append('fotos', new Blob([original], { type: 'image/jpeg' }), 'movil2.jpg');
    const res = await helper.post(`/api/admin/gatitos/${cat.id}/fotos`, form);
    assert.equal(res.status, 201, JSON.stringify(res.data));
    const photos = res.data.cat.photos;
    assert.equal(photos.length, 2);

    for (const url of [photos[0].lg, photos[0].sm, photos[0].og]) {
      const file = path.join(CAT_PHOTOS_DIR, path.basename(url));
      const meta = await sharp(file).metadata();
      assert.equal(meta.exif, undefined, `${url} no debe llevar EXIF`);
    }
    const og = await sharp(path.join(CAT_PHOTOS_DIR, path.basename(photos[0].og))).metadata();
    assert.deepEqual([og.width, og.height, og.format], [1200, 630, 'jpeg']);

    const served = await fetch(server.base + photos[0].sm);
    assert.equal(served.status, 200);
    assert.match(served.headers.get('cache-control'), /immutable/);

    const reordered = await helper.put(`/api/admin/gatitos/${cat.id}/fotos/orden`, {
      ids: [photos[1].id, photos[0].id],
    });
    assert.deepEqual(
      reordered.data.cat.photos.map((p) => p.id),
      [photos[1].id, photos[0].id],
    );
    const bad = await helper.put(`/api/admin/gatitos/${cat.id}/fotos/orden`, { ids: [photos[1].id] });
    assert.equal(bad.status, 400);

    const removed = await helper.delete(`/api/admin/gatitos/${cat.id}/fotos/${photos[0].id}`);
    assert.equal(removed.data.cat.photos.length, 1);
    assert.equal(fs.existsSync(path.join(CAT_PHOTOS_DIR, path.basename(photos[0].lg))), false);
  });

  test('rechaza ficheros que no son fotos', async () => {
    const cat = (await helper.post('/api/admin/gatitos', { name: 'Texto' })).data.cat;
    const form = new FormData();
    form.append('fotos', new Blob(['no soy una foto'], { type: 'image/jpeg' }), 'falso.jpg');
    const res = await helper.post(`/api/admin/gatitos/${cat.id}/fotos`, form);
    assert.equal(res.status, 400);
    assert.match(res.data.error, /fotos/);
  });
});

describe('solicitudes', () => {
  test('etapas, notas y cierre de la adopción', async () => {
    const cat = (await helper.post('/api/admin/gatitos', { name: 'Adoptable', status: 'disponible' })).data.cat;
    const anon = client(server.base);
    await anon.post('/api/solicitudes', validApplication({ catSlug: cat.slug, name: 'Rosa' }));

    const list = await helper.get('/api/admin/solicitudes?estado=nueva');
    const item = list.data.applications.find((a) => a.name === 'Rosa');
    assert.ok(item);
    assert.equal(item.catSlug, cat.slug);
    assert.ok(list.data.counts.nueva >= 1);

    const detail = await helper.get(`/api/admin/solicitudes/${item.id}`);
    assert.equal(detail.data.application.answers.housingType, 'piso');
    assert.equal(detail.data.application.cat.name, 'Adoptable');

    const approved = await helper.patch(`/api/admin/solicitudes/${item.id}`, {
      status: 'aprobada',
      catStatus: 'reservado',
    });
    assert.equal(approved.data.application.status, 'aprobada');
    assert.equal(approved.data.application.cat.status, 'reservado');
    assert.match(approved.data.application.notes.at(-1).body, /Nueva → Aprobada/);

    const noted = await helper.post(`/api/admin/solicitudes/${item.id}/notas`, { body: 'Visita el sábado' });
    assert.equal(noted.status, 201);
    assert.equal(noted.data.application.notes.at(-1).body, 'Visita el sábado');

    await helper.patch(`/api/admin/solicitudes/${item.id}`, { status: 'adoptado', catStatus: 'adoptado' });
    const adopted = (await helper.get(`/api/admin/gatitos/${cat.id}`)).data.cat;
    assert.equal(adopted.status, 'adoptado');
    assert.ok(adopted.adoptedAt);

    assert.equal((await helper.delete(`/api/admin/solicitudes/${item.id}`)).status, 403);
    assert.equal((await admin.delete(`/api/admin/solicitudes/${item.id}`)).status, 200);
  });

  test('resumen con pendientes y gatitos que necesitan un empujón', async () => {
    const res = await helper.get('/api/admin/resumen');
    assert.equal(res.status, 200);
    assert.equal(typeof res.data.applications.new, 'number');
    assert.ok(Array.isArray(res.data.needLove));
    assert.ok('likes' in (res.data.mostLoved[0] ?? { likes: 0 }));
  });

  test('mensajes: marcar leído y archivar', async () => {
    const anon = client(server.base);
    await anon.post('/api/mensajes', { name: 'Marta', email: 'marta@ejemplo.es', body: 'Hola', privacy: true });
    const list = await helper.get('/api/admin/mensajes');
    const message = list.data.items.find((m) => m.name === 'Marta');
    assert.equal(message.status, 'nuevo');
    const res = await helper.patch(`/api/admin/mensajes/${message.id}`, { status: 'archivado' });
    assert.equal(res.data.item.status, 'archivado');
    assert.equal((await helper.patch(`/api/admin/mensajes/${message.id}`, { status: 'otro' })).status, 400);
  });
});

describe('equipo', () => {
  test('alta con contraseña temporal, desactivación y cierre de sesiones', async () => {
    const created = await admin.post('/api/admin/equipo', { name: 'Paco', email: 'paco@bigotes.test' });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.equal(created.data.user.role, 'cuidabigotes');
    assert.equal(created.data.user.roleLabel, 'Cuidabigotes');

    const paco = client(server.base);
    const login = await paco.post('/api/auth/login', {
      email: 'PACO@bigotes.test',
      password: created.data.temporaryPassword,
    });
    assert.equal(login.status, 200);
    assert.equal((await paco.get('/api/admin/resumen')).status, 200);

    const dup = await admin.post('/api/admin/equipo', { name: 'Paco 2', email: 'paco@bigotes.test' });
    assert.equal(dup.status, 409);

    await admin.patch(`/api/admin/equipo/${created.data.user.id}`, { active: false });
    assert.equal((await paco.get('/api/admin/resumen')).status, 401);
    const again = await paco.post('/api/auth/login', {
      email: 'paco@bigotes.test',
      password: created.data.temporaryPassword,
    });
    assert.equal(again.status, 401);
  });

  test('también se dan de alta bigotes mayores, que gestionan el equipo', async () => {
    const created = await admin.post('/api/admin/equipo', { name: 'Lola', email: 'lola@bigotes.test', role: 'admin' });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.equal(created.data.user.roleLabel, 'Bigote mayor');

    const lola = client(server.base);
    await lola.post('/api/auth/login', { email: 'lola@bigotes.test', password: created.data.temporaryPassword });
    const byLola = await lola.post('/api/admin/equipo', { name: 'Rosa', email: 'rosa@bigotes.test' });
    assert.equal(byLola.status, 201);
    assert.equal(byLola.data.user.roleLabel, 'Cuidabigotes');

    const denied = await helper.post('/api/admin/equipo', { name: 'Intrusa', email: 'intrusa@bigotes.test', role: 'admin' });
    assert.equal(denied.status, 403);
    assert.match(denied.data.error, /bigote mayor/);
  });

  test('nadie se desactiva ni se cambia el papel a sí mismo', async () => {
    assert.equal((await admin.patch(`/api/admin/equipo/${admin.user.id}`, { active: false })).status, 400);
    assert.equal((await admin.patch(`/api/admin/equipo/${admin.user.id}`, { role: 'cuidabigotes' })).status, 400);
  });

  test('cambiar el papel de otra persona cierra sus sesiones', async () => {
    const target = await loggedIn(server.base, 'admin');
    const res = await admin.patch(`/api/admin/equipo/${target.user.id}`, { role: 'cuidabigotes' });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.roleLabel, 'Cuidabigotes');
    assert.equal((await target.get('/api/admin/resumen')).status, 401);
  });

  test('restablecer contraseña y cambiarla desde «Mi cuenta»', async () => {
    const fresh = await loggedIn(server.base, 'admin');
    const created = await fresh.post('/api/admin/equipo', { name: 'Eva', email: 'eva@bigotes.test' });
    const reset = await fresh.post(`/api/admin/equipo/${created.data.user.id}/restablecer`);
    assert.match(reset.data.temporaryPassword, /^[a-z]+-[0-9a-f]{6}-[a-z]+$/);

    const eva = client(server.base);
    await eva.post('/api/auth/login', { email: 'eva@bigotes.test', password: reset.data.temporaryPassword });
    const other = client(server.base);
    await other.post('/api/auth/login', { email: 'eva@bigotes.test', password: reset.data.temporaryPassword });

    const short = await eva.put('/api/auth/password', { current: reset.data.temporaryPassword, next: 'corta' });
    assert.equal(short.status, 400);
    const changed = await eva.put('/api/auth/password', {
      current: reset.data.temporaryPassword,
      next: 'mi-gato-favorito',
    });
    assert.equal(changed.status, 200);
    assert.equal((await eva.get('/api/auth/me')).data.user.email, 'eva@bigotes.test', 'la sesión actual sigue abierta');
    assert.equal((await other.get('/api/auth/me')).data.user, null, 'las demás sesiones se cierran');
    assert.equal((await other.get('/api/admin/resumen')).status, 401);
  });
});
