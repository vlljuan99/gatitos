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
  // Los favoritos están en la cabecera (en la barra inferior va «Colabora»).
  await expect(mainNav(page).getByRole('link', { name: 'Colabora' })).toBeVisible();
  await page.getByRole('link', { name: 'Favoritos (1)' }).click();
  await expect(page.getByRole('heading', { name: 'Luna', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Quiero conocerla' })).toBeVisible();
});

test('con la raya de inicio del iPhone, nada queda tapado por la barra inferior', async ({ page }) => {
  await page.goto('/gatitos/bigotin');
  // Chromium no emula env(safe-area-inset-bottom): se simula la del iPhone (34 px).
  await page.addStyleTag({ content: ':root { --zona-segura: 34px !important; }' });
  const cta = page.getByRole('link', { name: /Quiero adoptarle/ });
  await expect(cta).toBeVisible();
  const bubble = mainNav(page).getByRole('link', { name: 'Libro' }).locator('span').first();
  const [ctaBox, bubbleBox] = [await cta.boundingBox(), await bubble.boundingBox()];
  expect(ctaBox.y + ctaBox.height).toBeLessThanOrEqual(bubbleBox.y);

  await page.goto('/libro-de-gatos');
  await page.addStyleTag({ content: ':root { --zona-segura: 34px !important; }' });
  await page.mouse.wheel(0, 2000);
  const next = page.getByRole('button', { name: 'Página siguiente' });
  await expect(next).toBeInViewport();
  const navBox = await mainNav(page).boundingBox();
  const nextBox = await next.boundingBox();
  expect(nextBox.y + nextBox.height).toBeLessThanOrEqual(navBox.y);
});

test('filtros del catálogo', async ({ page }) => {
  await page.goto('/gatitos');
  await page.getByRole('button', { name: 'Seniors' }).click();
  await expect(page.getByRole('heading', { name: 'Bigotín' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tofu' })).toHaveCount(0);
});

test('libro de gatos: pasar páginas con flechas y con el dedo', async ({ page }) => {
  await page.goto('/match');
  // El antiguo match lleva al libro.
  await expect(page).toHaveURL(/\/libro-de-gatos$/);
  const pages = page.getByTestId('book-page');
  const counter = page.getByText(/^\d+ de \d+$/);
  await expect(counter).toHaveText(/^1 de /);
  await expect(page.getByRole('button', { name: 'Página anterior' })).toBeDisabled();

  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(counter).toHaveText(/^2 de /);
  await expect(pages.nth(1)).toBeInViewport({ ratio: 0.9 });

  // Deslizar con el dedo hacia la izquierda pasa a la página siguiente.
  const touch = await page.context().newCDPSession(page);
  const box = await pages.nth(1).boundingBox();
  let x = box.x + box.width * 0.8;
  const y = box.y + 120;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 0; i < 10; i += 1) {
    x -= 25;
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(counter).toHaveText(/^3 de /);

  // El corazón guarda en favoritos; nada de «no me gusta».
  const third = (await pages.nth(2).getByRole('heading').textContent()).trim();
  await pages.nth(2).getByRole('button', { name: `Me encanta ${third}` }).click();
  await expect(page.getByRole('link', { name: 'Favoritos (1)' })).toBeVisible();
  await expect(page.getByText(/no me gusta/i)).toHaveCount(0);

  // Al volver desde la ficha se abre por la misma página.
  await pages.nth(2).getByRole('link', { name: `Conocer más a ${third}` }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(third);
  await page.goBack();
  await expect(counter).toHaveText(/^3 de /);
});

test('del libro de gatos a la solicitud, sin pasar por la lista de gatitos', async ({ page }) => {
  await page.goto('/libro-de-gatos');
  const first = page.getByTestId('book-page').first();
  const name = (await first.getByRole('heading').textContent()).trim();
  await first.getByRole('link', { name: /Quiero adoptar/ }).click();
  // Directamente al formulario, con su gatito ya elegido.
  await expect(page.getByLabel('Nombre y apellidos')).toBeVisible();
  await expect(page.getByText('Solicitud para')).toContainText(name);
  await expect(page.getByText('¿A quién quieres conocer?')).toHaveCount(0);
  // Si quiere cambiar de gatito, vuelve a la lista.
  await page.getByRole('button', { name: 'Cambiar' }).click();
  await expect(page.getByRole('radio', { name: new RegExp(name) })).toBeChecked();
});

test('solicitud de adopción por pasos', async ({ page }) => {
  const next = () => page.getByRole('button', { name: /Siguiente/ }).click();
  const group = (name) => page.getByRole('group', { name });

  // Desde la ficha de un gatito se empieza ya por tus datos.
  await page.goto('/adoptar?gatito=luna');
  await expect(page.getByText('Solicitud para')).toContainText('Luna');

  await page.getByLabel('Nombre y apellidos').fill('Rosa Pérez');
  await page.getByLabel('Email').fill('rosa@ejemplo.es');
  await page.getByLabel('Teléfono').fill('611 222 333');
  await page.getByLabel('Municipio').fill('Almendralejo');
  // Fuera de Extremadura se puede seguir: se cruza con los viajes solidarios.
  await page.getByText('Otra provincia').click();
  await page.getByLabel('¿Cuál?').selectOption('Madrid');
  await expect(page.getByText(/viajes solidarios va a tu zona/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Apúntate a los viajes solidarios/ })).toBeVisible();
  await group('Provincia').getByText('Badajoz', { exact: true }).click();
  await expect(page.getByText(/viajes solidarios va a tu zona/)).toHaveCount(0);
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

test('viajes solidarios: alguien que viaja a menudo se apunta', async ({ page }) => {
  // La dirección antigua sigue funcionando.
  await page.goto('/transporte-solidario');
  await expect(page).toHaveURL(/\/viajes-solidarios$/);
  // Y se llega en dos toques desde cualquier página: «Colabora» en la barra inferior.
  await page.goto('/');
  await mainNav(page).getByRole('link', { name: 'Colabora' }).click();
  await page.getByRole('navigation', { name: 'Formas de colaborar' }).getByRole('link', { name: /Viajes solidarios/ }).click();
  await expect(page.getByRole('heading', { name: /Viajes solidarios/, level: 1 })).toBeVisible();

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
  await page.getByRole('button', { name: /Apuntarme a los viajes solidarios/ }).click();
  await expect(page.getByText('¡Gracias por apuntarte!')).toBeVisible();
});

test('hazte socio/a desde la web', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Quiero ser socio\/a/ }).click();
  await expect(page.getByRole('heading', { name: /Hazte socio\/a/, level: 1 })).toBeVisible();

  await page.getByRole('button', { name: /Hacerme socio\/a/ }).click();
  await expect(page.getByText('Escribe tu nombre y apellidos')).toBeVisible();

  await page.getByText('al mes').first().click();
  await page.getByLabel('Nombre y apellidos').fill('Elena Socia');
  await page.getByLabel('Email').fill('elena@ejemplo.es');
  await page.getByLabel('Municipio').fill('Almendralejo');
  await page.getByRole('group', { name: '¿Cómo prefieres pagar?' }).getByText('Bizum').click();
  await page.getByText('Soy mayor de edad').click();
  await page.getByText(/He leído la/).click();
  await page.getByRole('button', { name: /Hacerme socio\/a/ }).click();
  await expect(page.getByRole('heading', { name: '¡Ya casi eres de la familia!' })).toBeVisible();
  await expect(page.getByText('elena@ejemplo.es')).toBeVisible();
});
