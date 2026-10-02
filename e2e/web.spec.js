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

test('con la raya de inicio del iPhone, nada queda tapado por la barra inferior', async ({ page }) => {
  await page.goto('/gatitos/bigotin');
  // Chromium no emula env(safe-area-inset-bottom): se simula la del iPhone (34 px).
  await page.addStyleTag({ content: ':root { --zona-segura: 34px !important; }' });
  const cta = page.getByRole('link', { name: /Quiero adoptarle/ });
  await expect(cta).toBeVisible();
  const bubble = mainNav(page).getByRole('link', { name: 'Match' }).locator('span').first();
  const [ctaBox, bubbleBox] = [await cta.boundingBox(), await bubble.boundingBox()];
  expect(ctaBox.y + ctaBox.height).toBeLessThanOrEqual(bubbleBox.y);

  await page.goto('/match');
  await page.addStyleTag({ content: ':root { --zona-segura: 34px !important; }' });
  const like = page.getByRole('button', { name: 'Me encanta', exact: true });
  const navBox = await mainNav(page).boundingBox();
  const likeBox = await like.boundingBox();
  expect(likeBox.y + likeBox.height).toBeLessThanOrEqual(navBox.y);
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
  // Fuera de Extremadura se puede seguir: se cruza con el transporte solidario.
  await page.getByText('Otra provincia').click();
  await page.getByLabel('¿Cuál?').selectOption('Madrid');
  await expect(page.getByText(/transporte solidario viaja a tu zona/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Apúntate al transporte solidario/ })).toBeVisible();
  await group('Provincia').getByText('Badajoz', { exact: true }).click();
  await expect(page.getByText(/transporte solidario viaja a tu zona/)).toHaveCount(0);
  await next();
  await expect(page.getByText('Tienes que ser mayor de edad')).toBeVisible();
  await page.getByText('Soy mayor de edad').click();
  await next();

  // Recargar la página no borra lo escrito ni el paso en el que ibas.
  await page.reload();
  await expect(group('¿Dónde vives?')).toBeVisible();
  await expect(page.getByText('Solicitud para')).toContainText('Luna');

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
  await page.reload();
  await expect(page.getByLabel('Mensaje')).toHaveValue('¿Puedo ir a conocer a Tofu?');
  await expect(page.getByLabel('Nombre')).toHaveValue('Pepe');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByText('Necesitamos tu permiso para tratar estos datos')).toBeVisible();
  await page.getByText(/He leído la/).click();
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByText('¡Mensaje enviado!')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Mensaje')).toHaveValue('');
});

test('vista previa al compartir un gatito', async ({ request }) => {
  const html = await (await request.get('/gatitos/luna')).text();
  expect(html).toContain('<meta property="og:title" content="Luna busca hogar 🐾 · Bigotes" />');
  expect(html).toMatch(/og:image" content="http:\/\/localhost:4173\/uploads\/gatitos\/[0-9a-f-]+-og\.jpg"/);
});

test('transporte solidario: alguien que viaja a menudo se apunta', async ({ page }) => {
  await page.goto('/colabora');
  await page.getByRole('link', { name: /Apuntarme 🚗/ }).click();
  await expect(page.getByRole('heading', { name: /Transporte solidario/, level: 1 })).toBeVisible();

  await page.getByLabel('Nombre y apellidos').fill('Paco Ruta');
  await page.getByLabel('Email').fill('paco@ejemplo.es');
  await page.getByLabel('Teléfono').fill('622 111 000');
  await page.getByLabel('¿Desde dónde sales?').fill('Almendralejo');
  await page.getByLabel('Ciudad o pueblo').fill('Sevilla');
  await page.getByLabel('Provincia').selectOption('Sevilla');
  await page.getByRole('button', { name: /Añadir otro destino/ }).click();
  await page.getByLabel('Ciudad o pueblo').nth(1).fill('Madrid');
  await page.getByLabel('Provincia').nth(1).selectOption('Madrid');
  await page.getByText('Cada 15 días').click();
  await page.getByText('Soy mayor de edad').click();
  await page.getByText(/He leído la/).click();
  await page.getByRole('button', { name: /Apuntarme al transporte solidario/ }).click();
  await expect(page.getByText('¡Gracias por apuntarte!')).toBeVisible();
});
