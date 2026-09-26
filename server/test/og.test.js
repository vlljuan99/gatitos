import { dataDir, loggedIn, startServer } from './helpers.js';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ageText } from '../src/og.js';

let server;
let admin;
const clientDist = path.join(dataDir, 'dist');

before(async () => {
  fs.mkdirSync(path.join(clientDist, 'assets'), { recursive: true });
  fs.writeFileSync(
    path.join(clientDist, 'index.html'),
    '<!doctype html><html><head>\n<!--meta-->\n<title>Bigotes</title>\n<!--/meta-->\n</head><body><div id="root"></div></body></html>',
  );
  fs.writeFileSync(path.join(clientDist, 'assets', 'app-abc123.js'), 'console.log("hola")');
  server = await startServer({ clientDist });
  admin = await loggedIn(server.base, 'admin');
});
after(() => server.close());

const page = async (url) => {
  const res = await fetch(server.base + url);
  return { status: res.status, html: await res.text(), headers: res.headers };
};

test('cada gatito tiene su vista previa con foto para WhatsApp y redes', async () => {
  const cat = (
    await admin.post('/api/admin/gatitos', {
      name: 'Luna <script>',
      sex: 'hembra',
      status: 'disponible',
      summary: 'Bolita de "mimos" & ronroneos',
    })
  ).data.cat;
  const photo = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#aaa' } })
    .jpeg()
    .toBuffer();
  const form = new FormData();
  form.append('fotos', new Blob([photo], { type: 'image/jpeg' }), 'luna.jpg');
  await admin.post(`/api/admin/gatitos/${cat.id}/fotos`, form);

  const { status, html } = await page(`/gatitos/${cat.slug}`);
  assert.equal(status, 200);
  assert.match(html, /<title>Luna &lt;script&gt; busca hogar 🐾 · Bigotes<\/title>/);
  assert.match(html, /og:description" content="Bolita de &quot;mimos&quot; &amp; ronroneos"/);
  assert.match(html, /og:image" content="https:\/\/bigotes\.test\/uploads\/gatitos\/[0-9a-f-]+-og\.jpg"/);
  assert.match(html, /og:url" content="https:\/\/bigotes\.test\/gatitos\/luna-script"/);
  assert.doesNotMatch(html, /<script>/);
});

test('rutas conocidas, panel y 404', async () => {
  const home = await page('/');
  assert.equal(home.status, 200);
  assert.match(home.html, /Adopción de gatitos en Almendralejo/);
  assert.match(home.html, /og-bigotes\.jpg/);
  assert.equal(home.headers.get('cache-control'), 'no-cache');

  const match = await page('/match');
  assert.match(match.html, /Encuentra tu match gatuno · Bigotes/);

  const panel = await page('/admin/gatitos/3');
  assert.equal(panel.status, 200);
  assert.match(panel.html, /noindex/);

  assert.equal((await page('/gatitos/no-existe')).status, 404);
  assert.equal((await page('/cosas-raras')).status, 404);

  const borrador = (await admin.post('/api/admin/gatitos', { name: 'Borrador' })).data.cat;
  assert.equal((await page(`/gatitos/${borrador.slug}`)).status, 404);
});

test('los assets con hash se cachean para siempre', async () => {
  const res = await page('/assets/app-abc123.js');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control'), /immutable/);
  assert.equal((await page('/assets/no-existe.js')).status, 404);
});

test('sitemap y robots', async () => {
  const sitemap = await page('/sitemap.xml');
  assert.match(sitemap.html, /<loc>https:\/\/bigotes\.test\/gatitos\/luna-script<\/loc>/);
  assert.doesNotMatch(sitemap.html, /borrador/);
  const robots = await page('/robots.txt');
  assert.match(robots.html, /Disallow: \/admin/);
  assert.match(robots.html, /Sitemap: https:\/\/bigotes\.test\/sitemap\.xml/);
});

test('edad legible', () => {
  const now = new Date('2026-09-15');
  assert.equal(ageText('2026-09', now), 'menos de un mes');
  assert.equal(ageText('2026-08', now), '1 mes');
  assert.equal(ageText('2026-05', now), '4 meses');
  assert.equal(ageText('2025-09', now), '1 año');
  assert.equal(ageText('2019-01', now), '7 años');
  assert.equal(ageText(null, now), '');
});
