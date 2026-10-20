import { expect, test } from '@playwright/test';

const mainNav = (page) => page.getByRole('navigation', { name: 'Navegación principal' });

/** Desliza el dedo (eventos táctiles reales) desde el centro de un elemento. */
async function swipe(page, locator, dx, dy, steps = 12) {
  const touch = await page.context().newCDPSession(page);
  const box = await locator.boundingBox();
  let x = box.x + box.width / 2;
  let y = box.y + box.height / 2;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 0; i < steps; i += 1) {
    x += dx / steps;
    y += dy / steps;
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.detach();
}

/** Posición horizontal de la tira de fotos de un carrusel. */
const trackX = (carousel) => carousel.locator('> div').first().evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);

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
  const bubble = mainNav(page).getByRole('link', { name: 'Miau' }).locator('span').first();
  const [ctaBox, bubbleBox] = [await cta.boundingBox(), await bubble.boundingBox()];
  expect(ctaBox.y + ctaBox.height).toBeLessThanOrEqual(bubbleBox.y);

  // Al final del Miaustagram, lo último se puede leer por encima de la barra.
  await page.goto('/miaustagram');
  await page.addStyleTag({ content: ':root { --zona-segura: 34px !important; }' });
  const end = page.getByText(/Ya los has visto a todos/);
  await end.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 400);
  const navBox = await mainNav(page).boundingBox();
  const endBox = await end.boundingBox();
  expect(endBox.y + endBox.height).toBeLessThanOrEqual(navBox.y);
});

test('filtros del catálogo', async ({ page }) => {
  await page.goto('/gatitos');
  await page.getByRole('button', { name: 'Seniors' }).click();
  await expect(page.getByRole('heading', { name: 'Bigotín' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tofu' })).toHaveCount(0);
});

test('Miaustagram: feed, doble toque para «Me encanta» e historias', async ({ page }) => {
  // Las direcciones anteriores (match y libro de gatos) llevan al Miaustagram.
  await page.goto('/match');
  await expect(page).toHaveURL(/\/miaustagram$/);
  await page.goto('/libro-de-gatos');
  await expect(page).toHaveURL(/\/miaustagram$/);

  const posts = page.getByTestId('post');
  await expect(posts.first()).toBeVisible();
  expect(await posts.count()).toBeGreaterThan(2);
  const first = posts.first();
  await expect(first.getByRole('link', { name: /^@/ })).toBeVisible();
  await expect(first.getByText(/#\S+/).first()).toBeVisible();

  // Doble toque en la foto: a favoritos.
  await first.locator('[aria-roledescription="carrusel"]').dblclick();
  await expect(page.getByRole('link', { name: 'Favoritos (1)' })).toBeVisible();
  await expect(first.getByRole('button', { name: /^Quitar a .* de favoritos$/ })).toBeVisible();
  // El corazón lo quita otra vez.
  await first.getByRole('button', { name: /^Quitar a .* de favoritos$/ }).click();
  await expect(page.getByRole('link', { name: 'Favoritos (1)' })).toHaveCount(0);

  // Como en Instagram: bajar por el feed tocando una foto no la mueve de lado…
  const carousel = first.locator('[aria-roledescription="carrusel"]');
  await swipe(page, carousel, 40, -300);
  await page.waitForTimeout(300);
  expect(Math.abs(await trackX(carousel))).toBeLessThan(1);
  // …y deslizar de lado pasa a la foto siguiente.
  await first.scrollIntoViewIfNeeded();
  await swipe(page, carousel, -200, 10);
  await expect(first.getByText(/^2\/\d+$/)).toBeVisible();

  // Historias a pantalla completa: tocar a la derecha pasa, se cierra con la X.
  const stories = page.getByRole('list', { name: 'Historias' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await stories.getByRole('button').first().click();
  const dialog = page.getByRole('dialog', { name: /^Historia de / });
  await expect(dialog).toBeVisible();
  const where = dialog.locator('[aria-live="polite"]');
  const before = await where.textContent();
  const box = await dialog.boundingBox();
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
  await expect(where).not.toHaveText(before);
  await expect(dialog.getByRole('link', { name: /Quiero adoptar/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(dialog).toHaveCount(0);
  // Deslizar hacia abajo también cierra.
  await stories.getByRole('button').first().click();
  await expect(dialog).toBeVisible();
  await swipe(page, dialog, 0, 300, 8);
  await expect(dialog).toHaveCount(0);

  // Nada de «no me gusta» ni comentarios.
  await expect(page.getByText(/no me gusta|comentar/i)).toHaveCount(0);
});

test('del Miaustagram a la solicitud, sin pasar por la lista de gatitos', async ({ page }) => {
  await page.goto('/miaustagram');
  const first = page.getByTestId('post').first();
  const catName = await first.getAttribute('aria-label');
  await first.getByRole('link', { name: /Quiero adoptar/ }).click();
  // Directamente al formulario, con su gatito ya elegido.
  await expect(page.getByLabel('Nombre y apellidos')).toBeVisible();
  const chosen = catName.replace('Publicación de ', '');
  await expect(page.getByText('Solicitud para')).toContainText(chosen);
  await expect(page.getByText('¿A quién quieres conocer?')).toHaveCount(0);
  // Si quiere cambiar de gatito, vuelve a la lista.
  await page.getByRole('button', { name: 'Cambiar' }).click();
  await expect(page.getByRole('radio', { name: new RegExp(chosen) })).toBeChecked();
});

test('portada: las fotos llevan a su publicación del Miaustagram, que acaba con su perfil', async ({ page }) => {
  await page.goto('/');
  const photo = page.getByRole('link', { name: /^Ver a .* en el Miaustagram$/ }).first();
  const name = (await photo.getAttribute('aria-label')).replace('Ver a ', '').replace(' en el Miaustagram', '');
  await photo.click();
  await expect(page).toHaveURL(/\/miaustagram#gato-/);
  const post = page.getByRole('article', { name: `Publicación de ${name}` });
  await expect(post).toBeInViewport();
  // La última diapositiva no es una foto: es «Ver su perfil completo».
  const slides = post.locator('[aria-roledescription="carrusel"]');
  const total = Number((await post.getByText(/^1\/\d+$/).textContent()).split('/')[1]);
  for (let i = 1; i < total; i += 1) await swipe(page, slides, -220, 0);
  await post.getByRole('link', { name: 'Ver su perfil completo' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
});

test('quiero adoptar sin ningún «Me encanta»: al Miaustagram o al listado', async ({ page }) => {
  await page.goto('/adoptar');
  await expect(page.getByRole('heading', { name: /robado el corazón/ })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver el listado de gatitos' }).click();
  await expect(page.getByRole('radio').first()).toBeVisible();

  // Con un favorito ya no se pregunta y sale el primero de la lista.
  await page.goto('/gatitos/luna');
  await page.getByRole('button', { name: 'Me encanta Luna' }).click();
  await page.goto('/adoptar');
  await expect(page.getByRole('heading', { name: /robado el corazón/ })).toHaveCount(0);
  await expect(page.getByRole('radio').nth(1)).toHaveAccessibleName(/Luna/);

  // «Ir al Miaustagram» lleva al feed.
  await page.evaluate(() => localStorage.clear());
  await page.goto('/adoptar');
  await page.getByRole('link', { name: 'Ir al Miaustagram' }).click();
  await expect(page).toHaveURL(/\/miaustagram$/);
});

test('solicitud de adopción por pasos', async ({ page }) => {
  // Con el WhatsApp de la asociación en «Contacto», al terminar se puede avisar por ahí.
  await page.route('**/api/sitio', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.content.contact.whatsapp = '643 867 516';
    await route.fulfill({ response, json });
  });
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
  const notice = page.getByRole('link', { name: /Avísanos por WhatsApp/ });
  const href = new URL(await notice.getAttribute('href'));
  expect(href.searchParams.get('phone')).toBe('34643867516');
  expect(href.searchParams.get('text')).toBe('¡Hola! Soy Rosa y acabo de enviar la solicitud para adoptar a Luna 🐾');
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
