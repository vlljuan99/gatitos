// Genera los iconos PNG (favicon, app instalable) y la imagen por defecto
// para compartir en redes a partir del logo vectorizado de client/public
// (logo-cara.svg y logo-completo.svg, sacados de brand/logo-bigotes.jpg).
// El resultado se versiona, así que solo hace falta ejecutarlo al cambiar el logo:
//
//   node scripts/generate-brand.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/public');
const CREMA = '#faf6f3';
const mark = await fs.readFile(path.join(PUBLIC, 'logo-cara.svg'));
const full = await fs.readFile(path.join(PUBLIC, 'logo-completo.svg'));

async function icon(file, size, { padding = 0.12, radius = 0.22, background = CREMA } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(mark, { density: 300 }).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const r = Math.round(size * radius);
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${background}"/></svg>`,
  );
  await sharp(bg)
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC, file));
}

await icon('favicon-32.png', 32, { padding: 0.04, radius: 0.2 });
await icon('apple-touch-icon.png', 180, { padding: 0.14, radius: 0 });
await icon('icon-192.png', 192);
await icon('icon-512.png', 512);
// Las «maskable» se recortan en círculo en Android: más margen y fondo completo.
await icon('icon-maskable-512.png', 512, { padding: 0.24, radius: 0 });

// Imagen por defecto al compartir la web (1200×630): el logo completo sobre
// crema, con unos círculos pastel en las esquinas.
const logo = await sharp(full, { density: 300 }).resize(980, null).png().toBuffer();
const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${CREMA}"/>
  <circle cx="60" cy="40" r="150" fill="#f3ebe8"/>
  <circle cx="1150" cy="600" r="190" fill="#ebe4fd"/>
  <circle cx="1130" cy="30" r="80" fill="#fff1c2"/>
  <circle cx="40" cy="610" r="90" fill="#d7f3e8"/>
</svg>`);
await sharp(background)
  .composite([{ input: logo, gravity: 'center' }])
  .flatten({ background: CREMA })
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(path.join(PUBLIC, 'og-bigotes.jpg'));

console.log('Iconos e imagen para compartir generados en client/public');
