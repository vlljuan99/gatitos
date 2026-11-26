import { drawLine, formatNumber, ticketSummary } from '../lib/raffles.js';

// Papeleta de un sorteo, dibujada en el móvil con un <canvas> para mandarla
// por WhatsApp: cabecera, «Tus números» en casillas de 5 en fila, el resumen
// (participaciones, números y euros) y «¡Mucha suerte!».
// Dos diseños: «cesta» (el de la cesta de Navidad, con su gatito y su regalo,
// sacado de la papeleta original de la asociación: public/sorteos/) y
// «sencillo» (logo de Bigotes y el nombre del sorteo, para cualquier otro).

const W = 1199;
const COLS = 5;
const DISPLAY = '"Fredoka Variable", "Fredoka", ui-rounded, system-ui, sans-serif';
const TEXT = '"Nunito Variable", "Nunito", ui-rounded, system-ui, sans-serif';
// Letra con serifa como la de la papeleta original (sin fuentes de fuera).
const SERIF = 'Georgia, "Noto Serif", "Times New Roman", serif';

const C = {
  papel: '#fdfdfd',
  marco: '#5a3517',
  tinta: '#1f140d',
  marron: '#3a2312',
  suave: '#5c4130',
  pastilla: '#eedcca',
  casilla: '#fffdfb',
  borde: '#7a5236',
  // Colores de client/src/index.css para el diseño sencillo.
  crema: '#faf6f3',
  cacao: '#2b2727',
  canela: '#8a6d65',
  canelaClaro: '#f3ebe8',
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
  const svg = await (await fetch('/logo-completo.svg')).text();
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
    document.fonts.load(`700 34px ${TEXT}`),
    document.fonts.load(`700 44px ${SERIF}`),
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

/** Recorta el texto con «…» si no cabe en el ancho. */
function fitText(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let out = text;
  while (out.length > 4 && ctx.measureText(`${out}…`).width > max) out = out.slice(0, -1);
  return `${out}…`;
}

/** Cabecera y pie del diseño sencillo, dibujados aquí (mismo ancho que los de la cesta). */
async function simpleParts(raffle) {
  const logo = await loadLogo(230);
  const top = document.createElement('canvas');
  top.width = W;
  top.height = 520;
  let ctx = top.getContext('2d');
  ctx.fillStyle = C.papel;
  ctx.fillRect(0, 0, W, top.height);
  ctx.drawImage(logo, (W - logo.width) / 2, 40);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.cacao;
  let size = 84;
  do {
    ctx.font = `600 ${size}px ${DISPLAY}`;
    size -= 4;
  } while (ctx.measureText(raffle.title).width > 1040 && size > 40);
  ctx.fillText(fitText(ctx, raffle.title, 1040), W / 2, 390);
  ctx.strokeStyle = C.canela;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(420, 425);
  ctx.lineTo(780, 425);
  ctx.stroke();
  ctx.fillStyle = C.suave;
  ctx.font = `700 40px ${TEXT}`;
  ctx.fillText('¡Gracias por participar!', W / 2, 488);

  const bottom = document.createElement('canvas');
  bottom.width = W;
  bottom.height = 154;
  ctx = bottom.getContext('2d');
  ctx.fillStyle = C.papel;
  ctx.fillRect(0, 0, W, bottom.height);
  ctx.strokeStyle = C.marron;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(160, 72);
  ctx.lineTo(330, 72);
  ctx.moveTo(870, 72);
  ctx.lineTo(1040, 72);
  ctx.stroke();
  ctx.fillStyle = C.marron;
  ctx.font = `600 60px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('¡Mucha suerte!', W / 2, 72);
  // Marco: lados y línea de abajo.
  ctx.fillStyle = C.marco;
  ctx.fillRect(19, 0, 5, 134);
  ctx.fillRect(1175, 0, 5, 134);
  ctx.fillRect(19, 129, 1161, 5);
  // Lo mismo arriba.
  ctx = top.getContext('2d');
  ctx.fillStyle = C.marco;
  ctx.fillRect(19, 18, 1161, 5);
  ctx.fillRect(19, 18, 5, top.height - 18);
  ctx.fillRect(1175, 18, 5, top.height - 18);
  return [top, bottom];
}

/**
 * Dibuja la papeleta y la devuelve como JPEG.
 * raffle: { title, digits, drawInfo, design }; ticket: { name, ticketNumber, entries, amount, numbers }.
 */
export async function renderRaffleTicket(raffle, ticket) {
  await loadFonts();
  const [top, bottom] =
    raffle.design === 'cesta'
      ? await Promise.all([loadImage('/sorteos/papeleta-cesta-arriba.jpg'), loadImage('/sorteos/papeleta-cesta-abajo.jpg')])
      : await simpleParts(raffle);
  const numbers = [...ticket.numbers].sort((a, b) => a - b);
  const rows = Math.max(1, Math.ceil(numbers.length / COLS));
  // Con 4 cifras las casillas no cambian: caben igual.
  const midH = 22 + 62 + 34 + rows * 86 + 14 + 66 + 64 + 30;
  const H = top.height + midH + bottom.height;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = C.papel;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(top, 0, 0);
  const y0 = top.height;
  ctx.fillStyle = C.marco;
  ctx.fillRect(19, y0, 5, midH);
  ctx.fillRect(1175, y0, 5, midH);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // «TUS NÚMEROS»
  let y = y0 + 22;
  ctx.strokeStyle = C.marron;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(110, y + 31);
  ctx.lineTo(310, y + 31);
  ctx.moveTo(890, y + 31);
  ctx.lineTo(1085, y + 31);
  ctx.stroke();
  ctx.fillStyle = C.pastilla;
  roundRect(ctx, 325, y, 550, 62, 31);
  ctx.fill();
  ctx.fillStyle = C.marron;
  ctx.font = `700 34px ${SERIF}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
  ctx.fillText('TUS NÚMEROS', W / 2, y + 33);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  y += 62 + 34;

  // Casillas, de 5 en fila; la última fila, centrada.
  const bw = 186;
  const bh = 74;
  const gap = 195;
  numbers.forEach((n, i) => {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    const inRow = Math.min(COLS, numbers.length - row * COLS);
    const x = W / 2 - (inRow * gap - (gap - bw)) / 2 + col * gap;
    const by = y + row * 86;
    ctx.fillStyle = C.casilla;
    roundRect(ctx, x, by, bw, bh, 14);
    ctx.fill();
    ctx.strokeStyle = C.borde;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.tinta;
    ctx.font = `700 ${raffle.digits > 3 ? 40 : 44}px ${SERIF}`;
    ctx.fillText(formatNumber(n, raffle.digits), x + bw / 2, by + bh / 2 + 3);
  });
  y += rows * 86 + 14;

  // Resumen
  ctx.fillStyle = C.pastilla;
  roundRect(ctx, 168, y, 863, 66, 33);
  ctx.fill();
  ctx.fillStyle = C.marron;
  ctx.font = `400 31px ${SERIF}`;
  ctx.fillText(ticketSummary(ticket).replaceAll(' · ', '  ·  '), W / 2, y + 35);
  y += 66;

  // Quién, n.º de papeleta y cuándo se sortea.
  ctx.fillStyle = C.suave;
  ctx.font = `italic 400 24px ${SERIF}`;
  const line = [`${ticket.name} · papeleta n.º ${ticket.ticketNumber}`, drawLine(raffle)].filter(Boolean).join(' · ');
  ctx.fillText(fitText(ctx, line, 1060), W / 2, y + 38);

  ctx.drawImage(bottom, 0, top.height + midH);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se ha podido crear la imagen'))), 'image/jpeg', 0.9),
  );
}
