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

  await page.locator('input[type=file]').setInputFiles({ name: 'garfield.png', mimeType: 'image/png', buffer: PHOTO });
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

  await page.getByRole('button', { name: /Publicar ya/ }).click();
  await expect(page.getByText('¡Garfield ya está en la web! 🎉')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Garfield', level: 1 })).toBeVisible();

  const cat = (await (await request.get('/api/gatitos/garfield')).json()).cat;
  expect(cat.status).toBe('disponible');
  expect(cat.photos).toHaveLength(1);
  expect(cat.personality).toEqual(['glotón']);

  // Las cuidabigotes no ven la gestión del equipo.
  await page.goto('/admin');
  await expect(page.getByRole('link', { name: 'Equipo' })).toHaveCount(0);
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
