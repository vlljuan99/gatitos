import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// PNG de 1×1 píxel: suficiente para probar la subida desde el «móvil».
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function login(page, email) {
  await page.goto('/admin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill('bigotes-demo');
  await page.getByRole('button', { name: /Entrar/ }).click();
  await expect(page.getByRole('link', { name: /Nuevo gatito/ })).toBeVisible();
}

test('una cuidabigotes sube un gatito nuevo en un minuto', async ({ page, request }) => {
  await login(page, 'cuidabigotes@bigotes.local');
  await page.getByRole('link', { name: /Nuevo gatito/ }).click();

  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'garfield.png', mimeType: 'image/png', buffer: PHOTO });
  await expect(page.getByRole('img', { name: 'Foto 1' })).toBeVisible();
  await page.getByRole('button', { name: /Siguiente/ }).click();

  await page.getByRole('button', { name: /Siguiente/ }).click();
  await expect(page.getByText('Ponle un nombre')).toBeVisible();
  await page.getByLabel('Nombre').fill('Garfield');
  await page.getByText('♂ Macho').click();
  await page.getByRole('button', { name: /Siguiente/ }).click();

  await page.getByRole('button', { name: 'glotón', exact: true }).click();
  await page.getByLabel('Frase corta').fill('Le encanta la lasaña.');
  await page.getByRole('button', { name: /Siguiente/ }).click();
  await page.getByRole('button', { name: /Siguiente/ }).click();

  // Ficha interna (no sale en la web): de dónde viene, para sus papeles.
  await page.getByLabel('Lugar exacto de recogida').fill('Parque de la Piedad');
  await page.getByRole('button', { name: /Siguiente/ }).click();

  await page.getByRole('button', { name: /Publicar ya/ }).click();
  await expect(page.getByText('¡Garfield ya está en la web! 🎉')).toBeVisible();

  // Al publicar se ofrece la imagen para redes, lista para descargar o compartir.
  const share = page.getByRole('dialog', { name: /Compártelo en redes/ });
  await expect(share.getByRole('img', { name: 'Imagen para redes de Garfield' })).toBeVisible({ timeout: 20_000 });
  await expect(share.getByRole('link', { name: /Descargar imagen/ })).toHaveAttribute('href', /^blob:/);
  await expect(share.getByText(/¡Garfield busca hogar!/)).toBeVisible();
  await share.getByRole('radio', { name: /Historia/ }).click();
  await expect(share.getByRole('img', { name: 'Imagen para redes de Garfield' })).toBeVisible({ timeout: 20_000 });
  await share.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('heading', { name: 'Garfield', level: 1 })).toBeVisible();

  const cat = (await (await request.get('/api/gatitos/garfield')).json()).cat;
  expect(cat.status).toBe('disponible');
  expect(cat.photos).toHaveLength(1);
  expect(cat.personality).toEqual(['glotón']);

  // Las cuidabigotes no ven la gestión del equipo.
  await page.goto('/admin');
  await expect(page.getByRole('link', { name: 'Equipo' })).toHaveCount(0);
});

test('el alta de un gatito y los cambios sin guardar sobreviven a recargar', async ({ page }) => {
  await login(page, 'cuidabigotes@bigotes.local');
  await page.getByRole('link', { name: /Nuevo gatito/ }).click();
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'mishi.png', mimeType: 'image/png', buffer: PHOTO });
  await expect(page.getByRole('img', { name: 'Foto 1' })).toBeVisible();
  await page.getByRole('button', { name: /Siguiente/ }).click();
  await page.getByLabel('Nombre').fill('Mishi');

  await page.reload();
  await expect(page.getByText('Tenías un gatito a medias')).toBeVisible();
  await expect(page.getByLabel('Nombre')).toHaveValue('Mishi');
  await page.getByRole('button', { name: 'Paso anterior' }).click();
  await expect(page.getByRole('img', { name: 'Foto 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Empezar de cero' }).click();
  await expect(page.getByText('Tenías un gatito a medias')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Foto 1' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Tenías un gatito a medias')).toHaveCount(0);

  // En la ficha de un gatito, los cambios sin guardar también se recuperan.
  await page.goto('/admin/gatitos');
  await page.getByRole('link', { name: /Tofu/ }).first().click();
  await page.getByLabel('Frase corta').fill('Un torbellino con patitas enormes.');
  await expect(page.getByText('Cambios sin guardar')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Hemos recuperado los cambios que no habías guardado')).toBeVisible();
  await expect(page.getByLabel('Frase corta')).toHaveValue('Un torbellino con patitas enormes.');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Cambios guardados ✨')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Hemos recuperado los cambios')).toHaveCount(0);
});

test('la administración lleva una solicitud por sus etapas', async ({ page, request }) => {
  const sent = await request.post('/api/solicitudes', {
    data: {
      catSlug: 'canelo',
      name: 'Marta Gómez',
      email: 'marta@ejemplo.es',
      phone: '622 333 444',
      adult: true,
      municipality: 'Mérida',
      province: 'Badajoz',
      housingType: 'casa_patio',
      tenure: 'propiedad',
      windowsSafe: 'me_comprometo',
      adults: 2,
      kids: 'no',
      allAgree: 'si',
      allergies: 'no',
      hoursAlone: 'menos_4',
      why: 'Canelo es clavadito a nuestro antiguo gato.',
      commitVet: true,
      commitSterilize: true,
      commitFollowUp: true,
      privacy: true,
    },
  });
  expect(sent.status()).toBe(201);

  await login(page, 'admin@bigotes.local');
  await page.getByRole('navigation', { name: 'Panel' }).getByRole('link', { name: /Solicitudes/ }).click();
  await page.getByRole('link', { name: /Marta Gómez/ }).click();
  await expect(page.getByText('Canelo', { exact: true })).toBeVisible();
  await expect(page.getByText('Todavía no, pero las pondré')).toBeVisible();

  await page.getByRole('button', { name: 'Entrevista', exact: true }).click();
  await expect(page.getByText(/Nueva → Entrevista/)).toBeVisible();

  await page.getByLabel('Nueva nota').fill('La llamamos el lunes');
  await page.getByRole('button', { name: 'Añadir nota' }).click();
  await expect(page.getByText('La llamamos el lunes')).toBeVisible();

  await page.getByRole('button', { name: 'Aprobada', exact: true }).click();
  await page.getByRole('button', { name: /Sí, marcar como reservado/ }).click();
  await expect(page.getByText(/Entrevista → Aprobada/)).toBeVisible();
  const canelo = (await (await request.get('/api/gatitos/canelo')).json()).cat;
  expect(canelo.status).toBe('reservado');
});

test('papeles: parte veterinario y contrato de adopción listos para imprimir', async ({ page, request }) => {
  await login(page, 'cuidabigotes@bigotes.local');
  await page.getByRole('navigation', { name: 'Panel' }).getByRole('link', { name: /Gatitos/ }).click();
  await page.getByRole('link', { name: /Luna/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Papeles para imprimir 🖨️' })).toBeVisible();

  // Los enlaces llevan su permiso: se abren aunque no viaje la cookie (app instalada, visor del móvil).
  const ficha = page.getByRole('link', { name: 'Abrir Ficha del gato en PDF' });
  await expect(ficha).toHaveAttribute('href', /^\/api\/papeles\/gatito\/\d+\/ficha\?t=/);
  const fichaPdf = await request.get(await ficha.getAttribute('href'));
  expect(fichaPdf.headers()['content-type']).toContain('application/pdf');

  // Nuevo parte: quien lo lleva es su casa de acogida.
  await page.getByRole('button', { name: 'Nuevo parte' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Nuevo parte veterinario' });
  await expect(sheet.getByLabel('¿Quién lo lleva?')).toHaveValue('Lucía Fernández (demo)');
  await sheet.getByRole('button', { name: /Crear parte/ }).click();
  const created = page.getByRole('dialog', { name: /Parte V-\d{4}-001 listo/ });
  const parte = created.getByRole('link', { name: /Abrir el parte/ });
  await expect(parte).toHaveAttribute('href', /\/api\/papeles\/parte\/\d+\?t=/);
  expect((await request.get(await parte.getAttribute('href'))).headers()['content-type']).toContain('application/pdf');
  await created.getByRole('button', { name: 'Hecho' }).click();
  await expect(page.getByText('Falta completar')).toBeVisible();

  // Contrato desde la solicitud aprobada: se añade el DNI y sale numerado.
  const sent = await request.post('/api/solicitudes', {
    data: {
      catSlug: 'luna',
      name: 'Rosa Pérez',
      email: 'rosa@ejemplo.es',
      phone: '633 444 555',
      adult: true,
      municipality: 'Almendralejo',
      province: 'Badajoz',
      housingType: 'piso',
      tenure: 'propiedad',
      windowsSafe: 'si',
      adults: 1,
      kids: 'no',
      allAgree: 'si',
      allergies: 'no',
      hoursAlone: '4_8',
      why: 'Luna me robó el corazón en la web.',
      commitVet: true,
      commitSterilize: true,
      commitFollowUp: true,
      privacy: true,
    },
  });
  expect(sent.status()).toBe(201);
  await page.getByRole('navigation', { name: 'Panel' }).getByRole('link', { name: /Solicitudes/ }).click();
  await page.getByRole('link', { name: /Rosa Pérez/ }).click();
  await page.getByRole('button', { name: 'Aprobada', exact: true }).click();
  await page.getByRole('button', { name: /No, solo cambiar la solicitud/ }).click();
  await page.getByRole('button', { name: 'Preparar contrato' }).click();
  const contract = page.getByRole('dialog', { name: 'Datos para el contrato' });
  await contract.getByLabel('DNI / NIE').fill('12345678Z');
  await contract.getByLabel('Código postal').fill('06200');
  await contract.getByRole('button', { name: 'Preparar contrato' }).click();
  await expect(page.getByText(/N\.º A-\d{4}-001/)).toBeVisible();
  const link = page.getByRole('link', { name: /Contrato A-\d{4}-001 en PDF/ });
  expect((await request.get(await link.getAttribute('href'))).headers()['content-type']).toContain('application/pdf');

  // Y en «Papeles» están todos, también en blanco.
  await page.goto('/admin/papeles');
  await expect(page.getByRole('link', { name: 'Abrir Contrato de adopción en PDF' })).toHaveAttribute('href', /en-blanco\/contrato/);
});

test('una solicitud de Madrid muestra quién del transporte solidario viaja allí', async ({ page, request }) => {
  const signup = await request.post('/api/transporte', {
    data: {
      name: 'Inés Carretera',
      email: 'ines@ejemplo.es',
      phone: '644 555 666',
      origin: 'Almendralejo',
      destinations: [{ city: 'Alcalá de Henares', province: 'Madrid' }],
      frequency: 'semanal',
      adult: true,
      privacy: true,
    },
  });
  expect(signup.status()).toBe(201);
  const sent = await request.post('/api/solicitudes', {
    data: {
      catSlug: 'tofu',
      name: 'Javier Madrileño',
      email: 'javier@ejemplo.es',
      phone: '655 777 888',
      adult: true,
      municipality: 'Alcalá de Henares',
      province: 'Madrid',
      housingType: 'piso',
      tenure: 'propiedad',
      windowsSafe: 'si',
      adults: 2,
      kids: 'no',
      allAgree: 'si',
      allergies: 'no',
      hoursAlone: '4_8',
      why: 'Tofu nos ha conquistado.',
      commitVet: true,
      commitSterilize: true,
      commitFollowUp: true,
      privacy: true,
    },
  });
  expect(sent.status()).toBe(201);

  await login(page, 'cuidabigotes@bigotes.local');
  await page.getByRole('navigation', { name: 'Panel' }).getByRole('link', { name: /Solicitudes/ }).click();
  const row = page.getByRole('link', { name: /Javier Madrileño/ });
  await expect(row.getByText('📍 Madrid')).toBeVisible();
  await expect(row.getByText('🚗 1 viaja allí')).toBeVisible();
  await row.click();
  await expect(page.getByRole('heading', { name: 'Vive fuera de Extremadura' })).toBeVisible();
  await expect(page.getByText('Inés Carretera')).toBeVisible();
  await expect(page.getByText(/Va a Alcalá de Henares/)).toBeVisible();

  // En la bandeja del transporte se confirma y se busca por ciudad.
  await page.goto('/admin/transporte');
  await page.getByPlaceholder('Buscar ciudad o provincia').fill('alcala');
  await page.getByRole('button', { name: /Inés Carretera/ }).click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.getByRole('tab', { name: /Confirmados/ }).click();
  await expect(page.getByText('Inés Carretera')).toBeVisible();
});

test('un bigote mayor da de alta a alguien desde el resumen', async ({ page }) => {
  await login(page, 'admin@bigotes.local');
  await page.getByRole('link', { name: /Añadir al equipo/ }).click();

  const sheet = page.getByRole('dialog', { name: 'Añadir al equipo' });
  await sheet.getByLabel('Nombre').fill('Lola Martín');
  await sheet.getByLabel('Email').fill('lola@bigotes.local');
  await sheet.getByText('Bigote mayor').click();
  await expect(sheet.getByText(/da de alta al equipo/)).toBeVisible();
  await sheet.getByRole('button', { name: /Crear acceso/ }).click();

  const password = page.getByRole('dialog', { name: 'Contraseña temporal' });
  await expect(password.getByText(/^[a-z]+-[0-9a-f]{6}-[a-z]+$/)).toBeVisible();
  await password.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByText('lola@bigotes.local')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Lola Martín' }).getByText('👑 Bigote mayor')).toBeVisible();
});

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

test('vídeos: se suben desde la ficha y salen en la web', async ({ page }) => {
  test.skip(!hasFfmpeg, 'ffmpeg no está instalado');
  const file = path.join(os.tmpdir(), 'bigotes-e2e-video.mp4');
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=720x1280:rate=30', '-t', '2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file,
  ]);

  await login(page, 'cuidabigotes@bigotes.local');
  await page.getByRole('navigation', { name: 'Panel' }).getByRole('link', { name: /Gatitos/ }).click();
  await page.getByRole('link', { name: /Morena/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Morena', level: 1 })).toBeVisible();

  await page.locator('input[type=file][accept="video/*"]').setInputFiles(file);
  await expect(page.getByText('Preparando el vídeo…')).toBeVisible();
  await expect(page.getByText(/Vídeo listo/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Ver vídeo 1 de Morena' })).toBeVisible();

  await page.goto('/gatitos');
  await expect(page.getByRole('link', { name: /Morena/ }).getByText('Vídeo')).toBeVisible();
  await page.goto('/gatitos/morena');
  await page.getByRole('button', { name: 'Ver vídeo' }).click();
  const video = page.getByLabel('Vídeo de Morena');
  await expect(video).toBeInViewport();
  expect(await video.getAttribute('poster')).toMatch(/-poster\.webp$/);
});
