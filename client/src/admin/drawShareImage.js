import { catFacts, contactLines, healthItems } from '../lib/shareText.js';

// Imagen para compartir un gatito en Instagram, Facebook o WhatsApp, dibujada
// en el propio móvil con un <canvas>: sus fotos en polaroid, su nombre, sus
// datos y el contacto de la asociación, con los colores y el logo de Bigotes.
// Sale en JPEG (Instagram no admite WebP).

export const FORMATS = {
  post: { label: 'Publicación', hint: 'Instagram y Facebook', width: 1080, height: 1350 },
  historia: { label: 'Historia', hint: 'Historias y estados', width: 1080, height: 1920 },
};

// Colores de client/src/index.css.
const C = {
  crema: '#faf6f3',
  cacao: '#2b2727',
  cacaoSuave: '#6b5f5c',
  canela: '#8a6d65',
  tinta: '#977b73',
  canelaClaro: '#f3ebe8',
  canelaPastel: '#d9c6c0',
  menta: '#d7f3e8',
  mentaOscuro: '#1d6b52',
  lavanda: '#ebe4fd',
  lavandaOscuro: '#5b43a8',
  mantequilla: '#fff1c2',
  mantequillaOscuro: '#7a5200',
  melocoton: '#ffe4d1',
  melocotonOscuro: '#9a3412',
  rosa: '#eeb5bd',
};
const DISPLAY = '"Fredoka Variable", "Fredoka", ui-rounded, system-ui, sans-serif';
const TEXT = '"Nunito Variable", "Nunito", ui-rounded, system-ui, sans-serif';
const CHIP_TONES = [
  [C.lavanda, C.lavandaOscuro],
  [C.menta, C.mentaOscuro],
  [C.mantequilla, C.mantequillaOscuro],
  [C.melocoton, C.melocotonOscuro],
];

// Posiciones de cada formato. La historia deja libres arriba y abajo las zonas
// que tapa Instagram con su interfaz.
const LAYOUTS = {
  post: {
    logo: { height: 84, top: 50, align: 'left' },
    polaroid: { top: 170, width: 740, margin: 30, band: 112 },
    footer: { top: 1196, height: 124 },
  },
  historia: {
    logo: { height: 112, top: 150, align: 'center' },
    polaroid: { top: 330, width: 860, margin: 34, band: 128 },
    footer: { top: 1500, height: 150 },
    note: 1712,
  },
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se ha podido cargar ${src}`));
    img.src = src;
  });
}

/** El SVG del logo no trae medidas: se las pone para que el canvas lo dibuje en todos los navegadores. */
async function loadLogo(height) {
  const svg = await (await fetch('/logo-texto.svg')).text();
  const [, , vw, vh] = (svg.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 4 1').split(/\s+/).map(Number);
  const width = Math.round((height * vw) / vh);
  const url = URL.createObjectURL(new Blob([svg.replace('<svg ', `<svg width="${width}" height="${height}" `)], { type: 'image/svg+xml' }));
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadFonts() {
  if (!document.fonts?.load) return;
  await Promise.all([
    document.fonts.load(`600 80px ${DISPLAY}`),
    document.fonts.load(`800 34px ${TEXT}`),
    document.fonts.load(`700 30px ${TEXT}`),
  ]).catch(() => {});
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Recorta la foto para llenar el hueco, un poco hacia arriba (donde suele estar la cara). */
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = Math.max(0, Math.min(img.naturalHeight - sh, (img.naturalHeight - sh) * 0.4));
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** Tamaño de letra más grande (hasta max) con el que el texto cabe en el ancho. */
function fitFont(ctx, text, { family, weight, max, min, width }) {
  for (let size = max; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= width) return size;
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return min;
}

function heart(ctx, x, y, size, color, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.bezierCurveTo(0, 0, -50, 0, -50, 30);
  ctx.bezierCurveTo(-50, 60, -15, 75, 0, 95);
  ctx.bezierCurveTo(15, 75, 50, 60, 50, 30);
  ctx.bezierCurveTo(50, 0, 0, 0, 0, 30);
  ctx.fill();
  ctx.restore();
}

function paw(ctx, x, y, size, color, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = color;
  const blob = (cx, cy, rx, ry, rot = 0) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  };
  blob(0, 22, 30, 25);
  blob(-38, -12, 12, 16, -0.4);
  blob(-14, -34, 12, 17, -0.15);
  blob(14, -34, 12, 17, 0.15);
  blob(38, -12, 12, 16, 0.4);
  ctx.restore();
}

/** Foto en marco de polaroid, girada, con el nombre escrito abajo. */
function polaroid(ctx, img, { cx, cy, width, margin, band, angle, label, labelWidth, labelOffset = 0 }) {
  const photo = width - margin * 2;
  const height = margin + photo + band;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.shadowColor = 'rgba(58, 42, 48, 0.28)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, -width / 2, -height / 2, width, height, 14);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  roundRect(ctx, -photo / 2, -height / 2 + margin, photo, photo, 6);
  ctx.clip();
  drawCover(ctx, img, -photo / 2, -height / 2 + margin, photo, photo);
  ctx.restore();
  if (label) {
    const size = fitFont(ctx, label, { family: DISPLAY, weight: 600, max: band * 0.78, min: 36, width: labelWidth ?? photo });
    ctx.fillStyle = C.cacao;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${size}px ${DISPLAY}`;
    ctx.fillText(label, labelOffset, height / 2 - band / 2 + 4);
  }
  ctx.restore();
  return height;
}

function pill(ctx, text, { x, y, height, bg, fg, font, padding }) {
  ctx.font = font;
  const width = ctx.measureText(text).width + padding * 2;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padding, y + height / 2 + 2);
  return width;
}

/** Etiquetas centradas, en una o dos filas. Devuelve dónde acaban. */
function chips(ctx, items, { top, width, canvasWidth, height, gap, font, padding }) {
  ctx.font = font;
  const widths = items.map((text) => ctx.measureText(text).width + padding * 2);
  const rows = [[]];
  let rowWidth = 0;
  widths.forEach((w, i) => {
    if (rowWidth + w > width && rows.at(-1).length) {
      rows.push([]);
      rowWidth = 0;
    }
    rows.at(-1).push(i);
    rowWidth += w + gap;
  });
  let y = top;
  for (const row of rows.slice(0, 2)) {
    const total = row.reduce((sum, i) => sum + widths[i], 0) + gap * (row.length - 1);
    let x = (canvasWidth - total) / 2;
    for (const i of row) {
      const [bg, fg] = CHIP_TONES[i % CHIP_TONES.length];
      pill(ctx, items[i], { x, y, height, bg, fg, font, padding });
      x += widths[i] + gap;
    }
    y += height + gap;
  }
  return y - gap;
}

/**
 * Dibuja la imagen y la devuelve como Blob JPEG.
 * photos: URLs de las fotos (la primera es la grande).
 */
export async function renderShareImage({ cat, contact, webUrl, format = 'post', photos }) {
  const { width: W, height: H } = FORMATS[format];
  const L = LAYOUTS[format];
  const [images, logo] = await Promise.all([
    Promise.all(photos.slice(0, 2).map((src) => loadImage(src))),
    loadLogo(L.logo.height).catch(() => null),
    loadFonts(),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Fondo crema con manchas pastel y huellitas.
  ctx.fillStyle = C.crema;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, color] of [
    [70, 110, 250, C.canelaClaro],
    [W - 40, 60, 150, C.mantequilla],
    [W + 20, H - 120, 330, C.lavanda],
    [-10, H - 260, 180, C.menta],
  ]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  paw(ctx, W - 120, L.logo.top + 40, 70, C.canelaPastel, 0.35);
  paw(ctx, 70, L.polaroid.top + 520, 50, C.canelaPastel, -0.3);

  if (logo) {
    const x = L.logo.align === 'center' ? (W - logo.width) / 2 : 60;
    ctx.drawImage(logo, x, L.logo.top, logo.width, logo.height);
  }

  // Polaroid grande con el nombre y, si hay otra foto, una pequeña encima.
  const P = L.polaroid;
  const second = images[1];
  const pHeight = P.margin + (P.width - P.margin * 2) + P.band;
  const cx = W / 2;
  const cy = P.top + pHeight / 2;
  const smallWidth = Math.round(P.width * 0.4);
  polaroid(ctx, images[0], {
    cx,
    cy,
    width: P.width,
    margin: P.margin,
    band: P.band,
    angle: -0.045,
    label: cat.name,
    // Con foto pequeña, el nombre se centra en la parte que queda libre.
    labelWidth: second ? P.width - smallWidth - P.margin * 2 : undefined,
    labelOffset: second ? -smallWidth / 2 + 10 : 0,
  });
  if (second) {
    polaroid(ctx, second, {
      cx: cx + P.width / 2 - smallWidth / 2 + 30,
      cy: P.top + pHeight - smallWidth * 0.55,
      width: smallWidth,
      margin: 18,
      band: 46,
      angle: 0.12,
    });
  }
  // Corazones en la esquina del marco, fuera de la foto para no tapar al gatito.
  heart(ctx, cx + P.width / 2 - 6, P.top - 34, 78, C.rosa, 0.3);
  heart(ctx, cx + P.width / 2 - 70, P.top - 52, 46, C.tinta, -0.2);

  // Sello «En adopción» sobre la esquina de la foto.
  ctx.save();
  ctx.translate(cx - P.width / 2 + 40, P.top + 60);
  ctx.rotate(-0.12);
  pill(ctx, 'EN ADOPCIÓN', { x: 0, y: 0, height: 74, bg: C.canela, fg: '#ffffff', font: `600 42px ${DISPLAY}`, padding: 32 });
  ctx.restore();

  // Datos del gatito: etiquetas y salud.
  let y = P.top + pHeight + 44;
  const facts = catFacts(cat);
  if (facts.length) {
    y = chips(ctx, facts, { top: y, width: W - 120, canvasWidth: W, height: 64, gap: 14, font: `800 32px ${TEXT}`, padding: 26 });
  }
  const health = healthItems(cat);
  if (health.length && y + 60 < L.footer.top) {
    ctx.fillStyle = C.cacaoSuave;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitFont(ctx, `✓ ${health.join(' · ')}`, { family: TEXT, weight: 700, max: 30, min: 22, width: W - 120 });
    ctx.fillText(`✓ ${health.join(' · ')}`, W / 2, y + 36);
  }

  // Pie con el contacto de la asociación.
  const F = L.footer;
  ctx.fillStyle = C.cacao;
  roundRect(ctx, 40, F.top, W - 80, F.height, 36);
  ctx.fill();
  paw(ctx, 110, F.top + F.height / 2, 64, C.tinta, -0.25);
  const { main, extra } = contactLines(contact, webUrl);
  const textX = 170;
  const textWidth = W - 40 - textX - 40;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  const title = main ? `¿Te has enamorado? ${main}` : '¿Te has enamorado? Pide su adopción en la web';
  fitFont(ctx, title, { family: DISPLAY, weight: 600, max: F.height * 0.3, min: 26, width: textWidth });
  ctx.fillText(title, textX, F.top + F.height * 0.36);
  ctx.fillStyle = C.canelaPastel;
  fitFont(ctx, extra, { family: TEXT, weight: 700, max: F.height * 0.22, min: 20, width: textWidth });
  ctx.fillText(extra, textX, F.top + F.height * 0.7);

  if (L.note) {
    ctx.fillStyle = C.cacaoSuave;
    ctx.textAlign = 'center';
    ctx.font = `700 30px ${TEXT}`;
    ctx.fillText('Adopciones en Extremadura (Badajoz y Cáceres)', W / 2, L.note);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se ha podido crear la imagen'))), 'image/jpeg', 0.9);
  });
}
