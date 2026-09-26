import { expect, test } from '@playwright/test';

const mainNav = (page) => page.getByRole('navigation', { name: 'Navegación principal' });

test('portada, catálogo, ficha y favoritos', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('hogar');
  await expect(page.getByText('gatitos rescatados')).toBeVisible();

  await mainNav(page).getByRole('link', { name: 'Gatitos' }).click();
  await expect(page).toHaveURL(/\/gatitos$/);
  await page.getByRole('link', { name: /Luna/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Luna');
  await expect(page.getByText('Su historia')).toBeVisible();

  await page.getByRole('button', { name: 'Me encanta Luna' }).click();
  await expect(page.getByRole('button', { name: 'Quitar a Luna de favoritos' })).toBeVisible();
  await mainNav(page).getByRole('link', { name: /Favoritos/ }).click();
  await expect(page.getByRole('heading', { name: 'Luna', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Quiero conocerla' })).toBeVisible();
});

test('filtros del catálogo', async ({ page }) => {
  await page.goto('/gatitos');
  await page.getByRole('button', { name: 'Seniors' }).click();
  await expect(page.getByRole('heading', { name: 'Bigotín' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tofu' })).toHaveCount(0);
});

test('modo match: me encanta, siguiente, deshacer y deslizar', async ({ page }) => {
  await page.goto('/match');
  const card = page.getByTestId('match-card');
  const name = card.getByRole('heading');
  await expect(card).toBeVisible();

  await page.getByRole('button', { name: 'Me encanta', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('¡Os habéis gustado!');
  await page.getByRole('button', { name: 'Seguir mirando' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const second = await name.textContent();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(name).not.toHaveText(second);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(name).toHaveText(second);
  // La tarjeta recuperada vuelve animada desde el lado: esperar a que llegue.
  await expect.poll(async () => Math.round((await card.boundingBox()).x)).toBeGreaterThanOrEqual(0);
  await page.waitForTimeout(400);

  // Deslizar con el dedo: a la izquierda es «Siguiente» y a la derecha «Me encanta».
  const touch = await page.context().newCDPSession(page);
  async function swipe(direction) {
    const box = await card.boundingBox();
    let x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 0; i < 12; i += 1) {
      x += direction * 20;
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  await swipe(-1);
  await expect(name).not.toHaveText(second);
  const third = await name.textContent();
  await page.waitForTimeout(400);

  await swipe(1);
  await expect(page.getByText(/guardad[oa] en favoritos/)).toBeVisible();
  await expect(name).not.toHaveText(third);

  // Nada de «no me gusta»: solo «Me encanta» y «Siguiente».
  await expect(page.getByText(/no me gusta/i)).toHaveCount(0);
});

test('solicitud de adopción por pasos', async ({ page }) => {
  const next = () => page.getByRole('button', { name: /Siguiente/ }).click();
  const group = (name) => page.getByRole('group', { name });

  await page.goto('/adoptar?gatito=luna');
  await expect(page.getByRole('radio', { name: /Luna/ })).toBeChecked();
  await next();

  await page.getByLabel('Nombre y apellidos').fill('Rosa Pérez');
  await page.getByLabel('Email').fill('rosa@ejemplo.es');
  await page.getByLabel('Teléfono').fill('611 222 333');
  await page.getByLabel('Municipio').fill('Almendralejo');
  await page.getByText('Otra provincia').click();
  await expect(page.getByText(/solo damos en adopción en Extremadura/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Siguiente/ })).toBeDisabled();
  await group('Provincia').getByText('Badajoz', { exact: true }).click();
  await next();
  await expect(page.getByText('Tienes que ser mayor de edad')).toBeVisible();
  await page.getByText('Soy mayor de edad').click();
  await next();

  await group('¿Dónde vives?').getByText('Piso', { exact: true }).click();
  await group('Tu casa es…').getByText('De alquiler').click();
  await group('¿Tu casero permite animales?').getByText('Sí, se permiten').click();
  await page.getByText('Sí, ya las tengo').click();
  await next();

  await page.getByLabel(/Cuántas personas adultas/).fill('2');
  await group('¿Hay niños en casa?').getByText('No', { exact: true }).click();
  await group(/Todas las personas de casa/).getByText('Sí', { exact: true }).click();
  await group(/alergia/).getByText('No', { exact: true }).click();
  await next();

  await page.getByText('Menos de 4 horas').click();
  await page.getByLabel('¿Por qué quieres adoptar?').fill('Luna nos ha robado el corazón.');
  await next();

  await page.getByText(/atención veterinaria/).click();
  await page.getByText(/esterilizarlo/).click();
  await page.getByText(/contrato de adopción/).click();
  await page.getByText(/He leído la/).click();
  await page.getByRole('button', { name: /Enviar solicitud/ }).click();
  await expect(page.getByRole('heading', { name: '¡Solicitud enviada!' })).toBeVisible();
});

test('contacto', async ({ page }) => {
  await page.goto('/contacto');
  await page.getByLabel('Nombre').fill('Pepe');
  await page.getByLabel('Email').fill('pepe@ejemplo.es');
  await page.getByLabel('Mensaje').fill('¿Puedo ir a conocer a Tofu?');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByText('Necesitamos tu permiso para tratar estos datos')).toBeVisible();
  await page.getByText(/He leído la/).click();
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByText('¡Mensaje enviado!')).toBeVisible();
});

test('vista previa al compartir un gatito', async ({ request }) => {
  const html = await (await request.get('/gatitos/luna')).text();
  expect(html).toContain('<meta property="og:title" content="Luna busca hogar 🐾 · Bigotes" />');
  expect(html).toMatch(/og:image" content="http:\/\/localhost:4173\/uploads\/gatitos\/[0-9a-f-]+-og\.jpg"/);
});
