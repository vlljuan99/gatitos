import { COLORS, formatDate } from './pdf.js';

// Listados en A4 (inventario de medicación, inventario general y registro de
// donaciones): una tabla que sigue en las páginas que haga falta y que
// termina con filas en blanco para seguir apuntando a mano.

const X = 28;
const W = 539;
const TOP = 96;
const BOTTOM = 800;
const HEAD_H = 20;
const MIN_ROW = 20;
const SIZE = 7.8;

function header(k, title, subtitle) {
  k.logo(X, 16, 156);
  const bx = 206;
  k.rect(bx, 18, X + W - bx, 60, { radius: 9, fill: COLORS.band });
  k.text(title, bx + 16, 46, { font: 'display', size: 18, color: COLORS.brown, spacing: 0.5 });
  if (subtitle) k.text(subtitle, bx + 16, 64, { font: 'semibold', size: 8.4, color: COLORS.brown });
}

function cellLines(k, text, width) {
  if (!text) return [];
  const out = [];
  for (const paragraph of String(text).split('\n')) {
    const { lines } = k.wrap(paragraph, Array(12).fill(width), { font: 'text', size: SIZE, min: SIZE });
    out.push(...lines);
  }
  return out;
}

/**
 * Tabla paginada. columns: [{ label, width, align }]; rows: [{ cells, group,
 * tone }] donde group es una fila de título (categoría) y tone resalta la
 * fila (p. ej. medicación caducada). top: y de inicio en la primera página.
 */
function paginate(k, { columns, rows, firstTop = TOP, blankRows = 5 }) {
  const lineH = SIZE + 2.4;
  const measured = rows.map((row) => {
    if (row.group) return { ...row, height: 17 };
    const lines = row.cells.map((cell, i) => cellLines(k, cell, columns[i].width - 10));
    return { ...row, lines, height: Math.max(MIN_ROW, Math.max(...lines.map((l) => l.length)) * lineH + 9) };
  });
  const pages = [];
  let current = [];
  let y = firstTop + HEAD_H;
  const limit = BOTTOM;
  for (const row of measured) {
    if (y + row.height > limit) {
      pages.push(current);
      current = [];
      y = TOP + HEAD_H;
    }
    current.push(row);
    y += row.height;
  }
  // Filas libres al final: las que quepan, y como mínimo blankRows.
  let free = Math.floor((limit - y) / MIN_ROW);
  if (free < blankRows) {
    pages.push(current);
    current = [];
    free = Math.floor((limit - TOP - HEAD_H) / MIN_ROW);
  }
  for (let i = 0; i < free; i += 1) current.push({ blank: true, height: MIN_ROW });
  pages.push(current);
  return { pages, lineH };
}

function drawTable(k, { columns, pageRows, top, lineH }) {
  const height = HEAD_H + pageRows.reduce((s, r) => s + r.height, 0);
  k.rect(X, top, W, height, { radius: 6, fill: COLORS.white, stroke: COLORS.border });
  k.doc.save();
  k.doc.roundedRect(X, top, W, height, 6).clip();
  k.doc.rect(X, top, W, HEAD_H).fill(COLORS.band);
  let y = top + HEAD_H;
  for (const row of pageRows) {
    if (row.group) k.doc.rect(X, y, W, row.height).fill(COLORS.soft);
    if (row.tone === 'alert') k.doc.rect(X, y, W, row.height).fill('#fbe9e3');
    y += row.height;
  }
  k.doc.restore();

  let cx = X;
  for (const [i, col] of columns.entries()) {
    k.text(col.label, cx + 5, top + 13.5, { font: 'extrabold', size: 7.6, width: col.width - 10, align: col.align ?? 'left' });
    if (i > 0) k.line(cx, top, cx, top + height, { color: COLORS.border, width: 0.7 });
    cx += col.width;
  }
  y = top + HEAD_H;
  for (const row of pageRows) {
    k.line(X, y, X + W, y, { color: COLORS.border, width: 0.7 });
    if (row.group) {
      k.text(row.group.toUpperCase(), X + 8, y + 12, { font: 'extrabold', size: 7.6, color: COLORS.brown, spacing: 0.6 });
    } else if (!row.blank) {
      let x = X;
      row.lines.forEach((lines, i) => {
        const col = columns[i];
        lines.forEach((line, j) => {
          k.text(line, x + 5, y + 6 + SIZE + j * lineH, {
            font: col.bold || (i === 0 && row.tone) ? 'bold' : 'text',
            size: SIZE,
            color: row.tone === 'alert' && col.alert ? '#9a3412' : COLORS.value,
            width: col.width - 10,
            align: col.align ?? 'left',
          });
        });
        x += col.width;
      });
    }
    y += row.height;
  }
}

function listDocument(k, { title, subtitle, columns, rows, intro, note }) {
  const firstTop = intro ? TOP + intro.height + 10 : TOP;
  const { pages, lineH } = paginate(k, { columns, rows, firstTop });
  return pages.map((pageRows, p) => (kk) => {
    header(kk, title, subtitle);
    const top = p === 0 ? firstTop : TOP;
    if (p === 0 && intro) intro.draw(kk, TOP);
    drawTable(kk, { columns, pageRows, top, lineH });
    const foot = [note, pages.length > 1 ? `Página ${p + 1} de ${pages.length}` : ''].filter(Boolean).join('   ·   ');
    if (foot) kk.text(foot, X, 820, { size: 7, color: COLORS.muted, width: W, align: 'right' });
    kk.paw(X, 811, 11, COLORS.accent);
  });
}

const number = (value) =>
  value === null || value === undefined ? '' : Number(value).toLocaleString('es-ES', { maximumFractionDigits: 2 });
const amount = (value) => (value === null || value === undefined ? '' : `${Number(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);

// ---------------------------------------------------------------------------

export function medicationList(items, { today, k, blank = false }) {
  const soon = new Date(`${today}T12:00:00`);
  soon.setDate(soon.getDate() + 30);
  const soonIso = soon.toISOString().slice(0, 10);
  const columns = [
    { label: 'Medicamento', width: 128, bold: true },
    { label: 'Cantidad', width: 62 },
    { label: 'Caduca', width: 62, alert: true },
    { label: 'Instrucciones / pauta', width: 164 },
    { label: 'Dónde está', width: 77 },
    { label: 'Revisado', width: 46, align: 'center' },
  ];
  const rows = (blank ? [] : items).map((item) => {
    const expired = item.expiresOn && item.expiresOn < today;
    const expiring = item.expiresOn && !expired && item.expiresOn <= soonIso;
    const state = expired ? '\nCADUCADO' : expiring ? '\nCaduca pronto' : '';
    return {
      tone: expired || expiring ? 'alert' : undefined,
      cells: [
        item.name,
        [number(item.quantity), item.unit].filter(Boolean).join(' '),
        item.expiresOn ? `${formatDate(item.expiresOn)}${state}` : 'Sin fecha',
        [item.instructions, item.notes].filter(Boolean).join('\n'),
        item.location,
        '',
      ],
    };
  });
  return listDocument(k, {
    title: 'Inventario de medicación',
    subtitle: blank ? 'Para rellenar a mano' : `Situación a ${formatDate(today)}`,
    columns,
    rows,
    note: 'Revisa caducidades y marca «Revisado» al comprobar el botiquín',
  });
}

export function inventoryList(items, { today, categories, k, blank = false }) {
  const columns = [
    { label: 'Artículo', width: 168, bold: true },
    { label: 'Cantidad', width: 72 },
    { label: 'Mínimo', width: 52 },
    { label: 'Dónde está', width: 96 },
    { label: 'Notas', width: 99 },
    { label: 'Recuento', width: 52, align: 'center' },
  ];
  const rows = [];
  let group = null;
  for (const item of blank ? [] : items) {
    if (item.category !== group) {
      group = item.category;
      rows.push({ group: categories[group] ?? 'Otros' });
    }
    const low = item.minQuantity !== null && item.quantity <= item.minQuantity;
    rows.push({
      tone: low ? 'alert' : undefined,
      cells: [
        item.name,
        [number(item.quantity), item.unit].filter(Boolean).join(' ') + (low ? '\nQueda poco' : ''),
        item.minQuantity === null ? '' : number(item.minQuantity),
        item.location,
        [item.expiresOn && `Caduca ${formatDate(item.expiresOn)}`, item.notes].filter(Boolean).join('\n'),
        '',
      ],
    });
  }
  return listDocument(k, {
    title: 'Inventario general',
    subtitle: blank ? 'Para rellenar a mano' : `Situación a ${formatDate(today)}`,
    columns: columns.map((c, i) => (i === 1 ? { ...c, alert: true } : c)),
    rows,
    note: 'Apunta en «Recuento» lo que hay de verdad al revisar el almacén',
  });
}

export function donationsList(data, { methods, k, blank = false }) {
  const { donations = [], totals = {}, from, to } = data ?? {};
  const columns = [
    { label: 'Fecha', width: 56 },
    { label: 'Donante', width: 122, bold: true },
    { label: 'Tipo', width: 50 },
    { label: 'Importe / material', width: 140 },
    { label: 'Forma de pago', width: 66 },
    { label: 'Notas', width: 105 },
  ];
  const rows = (blank ? [] : [...donations].reverse()).map((d) => ({
    cells: [
      formatDate(d.date),
      [d.donorName || 'Anónimo', d.donorContact].filter(Boolean).join('\n'),
      d.kind === 'dinero' ? 'Dinero' : 'Material',
      d.kind === 'dinero' ? amount(d.amount) : d.description,
      d.kind === 'dinero' ? methods[d.method] ?? '' : '',
      d.notes,
    ],
  }));
  const intro = blank
    ? null
    : {
        height: 40,
        draw(kk, y) {
          const boxes = [
            ['Total en dinero', amount(totals.money ?? 0)],
            ['Donaciones de dinero', String(totals.moneyCount ?? 0)],
            ['Donaciones de material', String(totals.materialCount ?? 0)],
          ];
          const bw = (W - 20) / 3;
          boxes.forEach(([label, value], i) => {
            const bx = X + i * (bw + 10);
            kk.rect(bx, y, bw, 40, { radius: 8, fill: COLORS.box });
            kk.text(label, bx + 12, y + 15, { font: 'semibold', size: 7.8, color: COLORS.brown });
            kk.text(value, bx + 12, y + 32, { font: 'display', size: 14, color: COLORS.ink });
          });
        },
      };
  return listDocument(k, {
    title: 'Registro de donaciones',
    subtitle: blank ? 'Para rellenar a mano' : `Del ${formatDate(from)} al ${formatDate(to)}`,
    columns,
    rows,
    intro,
    note: 'Gracias a cada donante: cada gesto cuenta',
  });
}
