// Genera los iconos PNG de la web (favicon, app instalable) y la imagen por
// defecto para compartir en redes a partir del logo SVG. El resultado se
// versiona en client/public, así que solo hace falta ejecutarlo al cambiar el logo:
//
//   node scripts/generate-brand.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { catPortraitSvg } from './cat-art.js';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/public');
const logo = await fs.readFile(path.join(PUBLIC, 'favicon.svg'));

async function icon(file, size, { padding = 0.1, background = '#ffe3ea', radius = 0.22 } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const logoPng = await sharp(logo, { density: 600 }).resize(inner, inner).png().toBuffer();
  const r = Math.round(size * radius);
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${background}"/></svg>`,
  );
  await sharp(bg)
    .composite([{ input: logoPng, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC, file));
}

await icon('favicon-32.png', 32, { padding: 0.02, radius: 0.2 });
await icon('apple-touch-icon.png', 180, { padding: 0.12, radius: 0 });
await icon('icon-192.png', 192);
await icon('icon-512.png', 512);
// Las «maskable» se recortan en círculo en Android: más margen y fondo completo.
await icon('icon-maskable-512.png', 512, { padding: 0.2, radius: 0 });

// Imagen por defecto al compartir la web (1200×630): tres retratos y el logo.
const portraits = [
  { fur: 'naranja', eyes: 'verde', background: '#ffd9e2', accent: '#f6a6b8', tilt: -5 },
  { fur: 'carey', eyes: 'ambar', background: '#ebe4fd', accent: '#b9a6ee', tilt: 0 },
  { fur: 'gris', eyes: 'azul', background: '#d7f3e8', accent: '#8fd3b8', tilt: 5 },
];
const cards = await Promise.all(
  portraits.map(async (art, i) => {
    const png = await sharp(Buffer.from(catPortraitSvg(art))).resize(300, 375).png().toBuffer();
    const frame = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="330" height="405"><rect x="0" y="0" width="330" height="405" rx="36" fill="#ffffff"/></svg>`,
    );
    const framed = await sharp(frame)
      .composite([{ input: await sharp(png).composite([{ input: Buffer.from('<svg width="300" height="375"><rect width="300" height="375" rx="26"/></svg>'), blend: 'dest-in' }]).png().toBuffer(), left: 15, top: 15 }])
      .png()
      .toBuffer();
    const rotated = await sharp(framed)
      .rotate([-6, 2, 7][i], { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return rotated;
  }),
);
const logoBig = await sharp(logo, { density: 800 }).resize(220, 220).png().toBuffer();
const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#fff7ef"/>
  <circle cx="120" cy="90" r="160" fill="#ffe3ea"/>
  <circle cx="1120" cy="560" r="200" fill="#ebe4fd"/>
  <circle cx="1080" cy="80" r="90" fill="#fff1c2"/>
</svg>`);
const badge = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260"><circle cx="130" cy="130" r="125" fill="#ffffff"/></svg>',
);
await sharp(background)
  .composite([
    { input: cards[0], left: 70, top: 130 },
    { input: cards[1], left: 430, top: 95 },
    { input: cards[2], left: 790, top: 130 },
    { input: badge, left: 470, top: 405 },
    { input: logoBig, left: 490, top: 425 },
  ])
  .flatten({ background: '#fff7ef' })
  .jpeg({ quality: 85, mozjpeg: true })
  .toFile(path.join(PUBLIC, 'og-bigotes.jpg'));

console.log('Iconos e imagen para compartir generados en client/public');
