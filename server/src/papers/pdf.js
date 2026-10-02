import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { ICONS } from './icons.js';

// Kit de dibujo de los papeles de Bigotes sobre PDFKit: cabecera con el logo,
// secciones con banda de título, campos con su línea para escribir, casillas,
// fechas «__ / __ / ____» y firmas. Lo que ya se sabe se imprime encima de la
// línea en azul tinta, como si estuviera relleno a mano; lo que no, se queda
// en blanco para escribirlo.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.resolve(__dirname, '../../assets/fonts');

/** Tamaños en puntos (1 pt = 1/72"). */
export const SIZES = {
  A4: [595.28, 841.89],
  A4L: [841.89, 595.28],
  A5: [419.53, 595.28],
  A5L: [595.28, 419.53],
};

export const COLORS = {
  ink: '#2b2727',
  label: '#3a3332',
  muted: '#7d706c',
  brown: '#5c3b33',
  accent: '#977b73',
  band: '#ecdfdb',
  box: '#f4e9e5',
  border: '#e2d3ce',
  line: '#9d8f8a',
  soft: '#faf6f3',
  value: '#24456e',
  white: '#ffffff',
};

const FONT_FILES = {
  display: 'fredoka-600-normal.ttf',
  displayMedium: 'fredoka-500-normal.ttf',
  text: 'nunito-400-normal.ttf',
  semibold: 'nunito-600-normal.ttf',
  bold: 'nunito-700-normal.ttf',
  extrabold: 'nunito-800-normal.ttf',
  italic: 'nunito-400-italic.ttf',
};
let fontData = null;
function fonts() {
  fontData ??= Object.fromEntries(
    Object.entries(FONT_FILES).map(([name, file]) => [name, fs.readFileSync(path.join(FONTS_DIR, file))]),
  );
  return fontData;
}

// El logo completo (con el lema) es el SVG vectorizado de la web. En Docker
// solo existe el build del cliente; en desarrollo y en las pruebas, public/.
const LOGO_FILES = [
  path.resolve(__dirname, '../../../client/dist/logo-completo.svg'),
  path.resolve(__dirname, '../../../client/public/logo-completo.svg'),
];
let logoData;
function logo() {
  if (logoData !== undefined) return logoData;
  const file = LOGO_FILES.find((f) => fs.existsSync(f));
  if (!file) {
    console.warn('[papeles] No encuentro logo-completo.svg: los PDF saldrán con el nombre en texto');
    logoData = null;
    return logoData;
  }
  const svg = fs.readFileSync(file, 'utf8');
  const [, , width, height] = svg.match(/viewBox="([^"]+)"/)[1].trim().split(/\s+/).map(Number);
  const paths = [...svg.matchAll(/<path d="([^"]+)"[^>]*?fill="([^"]+)"/g)].map((m) => ({ d: m[1], fill: m[2] }));
  logoData = { width, height, paths };
  return logoData;
}

/**
 * Las tipografías no tienen emojis (saldrían como cuadraditos): se quitan de
 * lo que se escribe en los papeles, p. ej. de las notas del historial.
 */
export const clean = (value) => String(value ?? '').replace(/(\p{Extended_Pictographic}|[\u200d\ufe0f])+ ?/gu, '');

/** «2026-10-12» → «12/10/2026». */
export function formatDate(value) {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-');
  return d ? `${d}/${m}/${y}` : `${m}/${y}`;
}

/**
 * Crea el kit de dibujo sobre un documento PDFKit. Todas las medidas en
 * puntos y con el origen arriba a la izquierda de la página (o de la media
 * hoja, cuando se imprimen dos por folio).
 */
export function kit(doc) {
  const f = fonts();
  for (const [name, data] of Object.entries(f)) doc.registerFont(name, data);

  const k = {
    doc,
    COLORS,

    use(font = 'text', size = 9, color = COLORS.ink) {
      doc.font(font).fontSize(size).fillColor(color);
      return k;
    },

    width(text, font = 'text', size = 9, options = {}) {
      doc.font(font).fontSize(size);
      return doc.widthOfString(String(text ?? ''), options);
    },

    /** Texto en una línea, sin saltos. align: left | center | right respecto a x (y width). */
    text(text, x, y, { font = 'text', size = 9, color = COLORS.ink, width, align = 'left', spacing = 0 } = {}) {
      k.use(font, size, color);
      const str = clean(text);
      const w = doc.widthOfString(str, { characterSpacing: spacing });
      let left = x;
      if (width !== undefined && align === 'center') left = x + (width - w) / 2;
      if (width !== undefined && align === 'right') left = x + width - w;
      doc.text(str, left, y, { lineBreak: false, characterSpacing: spacing, baseline: 'alphabetic' });
      return w;
    },

    /** Párrafo con saltos de línea dentro de width. Devuelve la altura usada. */
    paragraph(text, x, y, width, { font = 'text', size = 8.5, color = COLORS.ink, lineGap = 1.5, align = 'left' } = {}) {
      k.use(font, size, color);
      const options = { width, lineGap, align };
      const str = clean(text);
      const height = doc.heightOfString(str, options);
      doc.text(str, x, y, options);
      return height;
    },

    /** Reparte un texto en varias líneas de anchos dados (la primera puede ser más corta). */
    wrap(text, widths, { font = 'semibold', size = 9, min = 6.5 } = {}) {
      const words = clean(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
      if (words.length === 0) return { lines: [], size };
      for (let s = size; s >= min; s -= 0.5) {
        doc.font(font).fontSize(s);
        const lines = [];
        let line = '';
        let i = 0;
        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (doc.widthOfString(candidate) <= widths[Math.min(i, widths.length - 1)]) {
            line = candidate;
          } else {
            if (line) lines.push(line);
            i += 1;
            line = word;
          }
        }
        if (line) lines.push(line);
        const fits = lines.length <= widths.length && lines.every((l, j) => doc.widthOfString(l) <= widths[j]);
        if (fits) return { lines, size: s };
        if (s - 0.5 < min) {
          // No cabe ni con la letra más pequeña: se corta con «…».
          const cut = lines.slice(0, widths.length);
          const last = widths.length - 1;
          let tail = cut[last] ?? '';
          while (tail && doc.widthOfString(`${tail}…`) > widths[last]) tail = tail.slice(0, -1);
          cut[last] = `${tail.trimEnd()}…`;
          return { lines: cut, size: s };
        }
      }
      return { lines: [], size };
    },

    line(x1, y1, x2, y2, { color = COLORS.line, width = 0.6, dash } = {}) {
      doc.save().lineWidth(width).strokeColor(color);
      if (dash) doc.dash(dash, { space: dash });
      doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
      doc.restore();
    },

    rect(x, y, w, h, { radius = 0, fill, stroke, lineWidth = 0.8 } = {}) {
      doc.save().lineWidth(lineWidth);
      if (radius) doc.roundedRect(x, y, w, h, radius);
      else doc.rect(x, y, w, h);
      if (fill && stroke) doc.fillAndStroke(fill, stroke);
      else if (fill) doc.fill(fill);
      else if (stroke) doc.stroke(stroke);
      doc.restore();
    },

    /** Icono de Lucide (trazo) de tamaño size con su esquina en x, y. */
    icon(name, x, y, size = 12, { color = COLORS.brown, stroke = 2 } = {}) {
      const nodes = ICONS[name];
      if (!nodes) return;
      const s = size / 24;
      doc.save().translate(x, y).scale(s).lineWidth(stroke).lineCap('round').lineJoin('round').strokeColor(color);
      for (const [tag, a] of nodes) {
        if (tag === 'path') doc.path(a.d);
        else if (tag === 'circle') doc.circle(Number(a.cx), Number(a.cy), Number(a.r));
        else if (tag === 'rect') doc.roundedRect(Number(a.x), Number(a.y), Number(a.width), Number(a.height), Number(a.rx ?? 0));
        else if (tag === 'line') doc.moveTo(Number(a.x1), Number(a.y1)).lineTo(Number(a.x2), Number(a.y2));
        else if (tag === 'polyline' || tag === 'polygon') {
          const pts = a.points.trim().split(/[\s,]+/).map(Number);
          doc.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) doc.lineTo(pts[i], pts[i + 1]);
          if (tag === 'polygon') doc.closePath();
        }
        doc.stroke();
      }
      doc.restore();
    },

    /** Huella rellena (adorno del pie). */
    paw(x, y, size = 12, color = COLORS.brown) {
      const s = size / 24;
      doc.save().translate(x, y).scale(s).fillColor(color);
      doc.circle(11, 4, 2).fill();
      doc.circle(18, 8, 2).fill();
      doc.circle(20, 16, 2).fill();
      doc.path('M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z').fill();
      doc.restore();
    },

    /** Logo completo (con el lema) de ancho w. Devuelve la altura. */
    logo(x, y, w) {
      const data = logo();
      if (!data) {
        k.text('BIGOTES', x, y + w * 0.2, { font: 'display', size: w * 0.18, width: w, align: 'center' });
        return w * 0.3;
      }
      const s = w / data.width;
      doc.save().translate(x, y).scale(s);
      for (const p of data.paths) doc.path(p.d).fillColor(p.fill).fill('even-odd');
      doc.restore();
      return data.height * s;
    },

    /**
     * Sección: caja redondeada con banda de título. Devuelve la y donde
     * empieza el contenido. icon: nombre de Lucide (opcional).
     */
    section(x, y, w, h, title, { icon, band = 21, size = 10, note } = {}) {
      k.rect(x, y, w, h, { radius: 7, fill: COLORS.white, stroke: COLORS.border, lineWidth: 0.9 });
      doc.save();
      doc.roundedRect(x, y, w, h, 7).clip();
      doc.rect(x, y, w, band).fill(COLORS.band);
      doc.restore();
      let tx = x + 10;
      if (icon) {
        doc.save().circle(x + 10 + band * 0.42, y + band / 2, band * 0.42).fill(COLORS.brown).restore();
        k.icon(icon, x + 10 + band * 0.42 - band * 0.25, y + band / 2 - band * 0.25, band * 0.5, { color: COLORS.white, stroke: 2.2 });
        tx += band * 0.84 + 7;
      }
      const tw = k.text(title.toUpperCase(), tx, y + band / 2 + size * 0.36, { font: 'extrabold', size, color: COLORS.ink, spacing: 0.3 });
      if (note) k.text(note, tx + tw + 4, y + band / 2 + size * 0.36, { font: 'semibold', size: size * 0.85, color: COLORS.muted });
      return y + band;
    },

    /**
     * Campo con etiqueta y línea hasta x + w. El valor se imprime encima de
     * la línea; si no cabe, se reduce la letra y, en último caso, se corta.
     * lines > 1 añade líneas completas debajo (separadas por gap) y el
     * texto sigue por ellas. Devuelve la y de la última línea.
     */
    field(x, y, w, label, value, { size = 8.5, lines = 1, gap = 15, valueSize = size + 0.5, labelFont = 'text', labelColor = COLORS.label } = {}) {
      const lw = label ? k.text(label, x, y, { font: labelFont, size, color: labelColor }) + 4 : 0;
      const widths = [w - lw];
      k.line(x + lw, y + 1.5, x + w, y + 1.5);
      for (let i = 1; i < lines; i += 1) {
        k.line(x, y + 1.5 + gap * i, x + w, y + 1.5 + gap * i);
        widths.push(w);
      }
      if (value) {
        const { lines: out, size: s } = k.wrap(value, widths.map((v) => v - 3), { size: valueSize });
        out.forEach((text, i) => k.text(text, i === 0 ? x + lw + 2 : x + 2, y - 0.5 + gap * i, { font: 'semibold', size: s, color: COLORS.value }));
      }
      return y + gap * (lines - 1);
    },

    /** Fecha con su línea partida «__ / __ / ____» y el valor encima si se sabe. */
    dateField(x, y, label, value, { size = 8.5, part = 22, year = 36 } = {}) {
      const lw = label ? k.text(label, x, y, { size, color: COLORS.label }) + 5 : 0;
      const [yy, mm, dd] = value ? value.slice(0, 10).split('-') : [];
      const parts = [
        [part, dd],
        [part, mm],
        [year, yy],
      ];
      let cx = x + lw;
      parts.forEach(([pw, v], i) => {
        k.line(cx, y + 1.5, cx + pw, y + 1.5);
        if (v) k.text(v, cx, y - 0.5, { font: 'semibold', size: size + 0.5, color: COLORS.value, width: pw, align: 'center' });
        cx += pw;
        if (i < 2) {
          k.text('/', cx + 2, y, { size, color: COLORS.muted });
          cx += 9;
        }
      });
      return cx - x;
    },

    /** Casilla (cuadrado redondeado) con su marca si checked. */
    checkbox(x, y, checked = false, size = 8) {
      k.rect(x, y, size, size, { radius: 1.6, stroke: COLORS.ink, lineWidth: 0.7 });
      if (checked) {
        doc
          .save()
          .lineWidth(1.4)
          .lineCap('round')
          .lineJoin('round')
          .strokeColor(COLORS.value)
          .moveTo(x + size * 0.18, y + size * 0.52)
          .lineTo(x + size * 0.42, y + size * 0.8)
          .lineTo(x + size * 0.95, y - size * 0.05)
          .stroke()
          .restore();
      }
    },

    /** Opciones en línea: ☐ Sí  ☐ No… Devuelve la x final. */
    options(x, y, options, { size = 8.5, gap = 12, box = 8 } = {}) {
      let cx = x;
      for (const option of options) {
        k.checkbox(cx, y - box + 1, option.checked, box);
        cx += box + 3.5;
        cx += k.text(option.label, cx, y, { size, color: COLORS.label }) + gap;
      }
      return cx - gap;
    },

    /** Elemento de lista con casilla y texto que puede ocupar varias líneas. Devuelve la altura. */
    checkItem(x, y, w, text, { checked = false, size = 8.5, box = 8, lineGap = 1.2 } = {}) {
      k.checkbox(x, y + 0.5, checked, box);
      return Math.max(box, k.paragraph(text, x + box + 7, y - 0.5, w - box - 7, { size, lineGap, color: COLORS.label }));
    },

    /** Recuadro para firmar o sellar. */
    signatureBox(x, y, w, h) {
      k.rect(x, y, w, h, { radius: 3, stroke: COLORS.line, lineWidth: 0.7 });
    },

    /** Pie: huella entre dos líneas y, opcionalmente, un lema debajo. */
    footer(cx, y, width, motto, { size = 13 } = {}) {
      k.line(cx - width / 2, y, cx - 12, y, { color: COLORS.accent, width: 0.6 });
      k.line(cx + 12, y, cx + width / 2, y, { color: COLORS.accent, width: 0.6 });
      k.paw(cx - 6, y - 6.5, 12);
      if (motto) {
        const w = k.width(motto, 'displayMedium', size);
        k.text(motto, cx - w / 2 - 6, y + size + 8, { font: 'displayMedium', size, color: COLORS.brown });
        k.icon('heart', cx + w / 2 - 2, y + 9, size * 0.95, { color: COLORS.brown, stroke: 1.8 });
      }
    },
  };
  return k;
}

/**
 * Genera el PDF. pages es una lista de funciones (k) => void que dibujan cada
 * página en el tamaño indicado. Con twoUp (solo A5), cada folio A4 lleva dos
 * medias hojas con una línea para cortar; si sobra hueco, se repite la última
 * página (dos copias: una para cada parte, o una de repuesto).
 */
export function renderPdf({ size, pages, twoUp = false, title }) {
  const doc = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    lang: 'es-ES',
    displayTitle: true,
    info: { Title: title, Author: 'Bigotes, Asociación para la Ayuda al Gato Callejero', Creator: 'Panel de Bigotes' },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const k = kit(doc);
  const [w, h] = SIZES[size];
  const draw = (page, dx = 0, dy = 0) => {
    doc.save().translate(dx, dy);
    page(k);
    doc.restore();
  };

  const list = typeof pages === 'function' ? pages(k) : pages;
  if (twoUp && (size === 'A5' || size === 'A5L')) {
    const sheet = size === 'A5' ? SIZES.A4L : SIZES.A4;
    for (let i = 0; i < list.length; i += 2) {
      doc.addPage({ size: sheet, margin: 0 });
      const second = list[i + 1] ?? list[i];
      if (size === 'A5') {
        const half = sheet[0] / 2;
        draw(list[i], (half - w) / 2, 0);
        draw(second, half + (half - w) / 2, 0);
        k.line(half, 8, half, sheet[1] - 8, { color: COLORS.line, width: 0.4, dash: 3 });
        k.icon('scissors', half - 5, 1, 10, { color: COLORS.muted, stroke: 1.6 });
      } else {
        const half = sheet[1] / 2;
        draw(list[i], (sheet[0] - w) / 2, (half - h) / 2);
        draw(second, (sheet[0] - w) / 2, half + (half - h) / 2);
        k.line(8, half, sheet[0] - 8, half, { color: COLORS.line, width: 0.4, dash: 3 });
        k.icon('scissors', 1, half - 5, 10, { color: COLORS.muted, stroke: 1.6 });
      }
    }
  } else {
    for (const page of list) {
      doc.addPage({ size: [w, h], margin: 0 });
      draw(page);
    }
  }
  doc.end();
  return done;
}
