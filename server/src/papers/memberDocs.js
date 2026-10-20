import { COLORS } from './pdf.js';
import { a5Header } from './catDocs.js';
import { privacyText } from './agreements.js';

// Papeles de socios y socias (A5): el recibo de cada cuota, que también se
// manda por correo, y la hoja de inscripción para apuntarse en papel (en una
// jornada de adopción, por ejemplo). Sin datos salen en blanco.

const X = 14;
const W = 392;

const PERIOD_OPTIONS = [
  ['mensual', 'Mensual'],
  ['trimestral', 'Trimestral'],
  ['semestral', 'Semestral'],
  ['anual', 'Anual'],
];
const METHOD_OPTIONS = [
  ['bizum', 'Bizum'],
  ['transferencia', 'Transferencia'],
  ['efectivo', 'En mano'],
  ['otro', 'Otra'],
];
const checks = (list, value) =>
  list.map(([key, label]) => ({ label, checked: value === key || (key === 'otro' && value === 'tarjeta') }));

/** Datos de la asociación en letra pequeña, uno por línea. Devuelve la y final. */
function associationBlock(k, x, y, w, legal) {
  const lines = [
    legal.cif && `CIF ${legal.cif}`,
    legal.registry,
    legal.address,
    [legal.email, legal.web].filter(Boolean).join(' · '),
  ].filter(Boolean);
  k.text(legal.holder, x, y, { font: 'bold', size: 7.4, color: COLORS.brown });
  lines.forEach((line, i) => {
    const { lines: wrapped } = k.wrap(line, [w], { font: 'text', size: 6.8, min: 5.6 });
    k.text(wrapped[0] ?? '', x, y + 10 + i * 9, { size: 6.8, color: COLORS.muted });
  });
  return y + 10 + lines.length * 9;
}

// ---------------------------------------------------------------------------
// Recibo de cuota (A5)
// ---------------------------------------------------------------------------

export function memberReceipt(data, { legal }) {
  const p = data?.payment ?? {};
  const m = data?.member ?? {};
  const fs = 8.4;
  return [
    (k) => {
      a5Header(k, { title: 'RECIBO\nDE CUOTA', subtitle: 'SOCIO / SOCIA' });

      // Número, fecha y n.º de socio/a
      k.rect(X, 94, W, 48, { radius: 8, fill: COLORS.soft });
      k.text('N.º DE RECIBO', X + 12, 110, { font: 'extrabold', size: 7.6, spacing: 0.3 });
      k.field(X + 12, 130, 128, '', p.receiptNumber, { valueSize: 10.5 });
      k.text('FECHA DE PAGO', X + 156, 110, { font: 'extrabold', size: 7.6, spacing: 0.3 });
      k.dateField(X + 156, 130, '', p.paidOn, { size: 8, part: 19, year: 32 });
      k.text('SOCIO/A N.º', X + 282, 110, { font: 'extrabold', size: 7.6, spacing: 0.3 });
      k.field(X + 282, 130, W - 294, '', m.number ? String(m.number) : '', { valueSize: 10.5 });

      // Quién paga
      let top = k.section(X, 152, W, 84, 'Hemos recibido de', { icon: 'user', band: 19, size: 9 });
      k.field(X + 12, top + 19, W - 24, 'Nombre y apellidos:', m.name, { size: fs });
      k.field(X + 12, top + 38, 150, 'DNI / NIE:', m.dni, { size: fs });
      k.field(X + 172, top + 38, W - 184, 'Municipio:', m.municipality, { size: fs });
      k.field(X + 12, top + 57, W - 24, 'Dirección:', m.address, { size: fs });

      // Importe en número y en letra
      const ay = 246;
      k.rect(X, ay, W, 72, { radius: 9, fill: COLORS.box });
      k.text('IMPORTE', X + 12, ay + 18, { font: 'extrabold', size: 7.6, spacing: 0.3 });
      if (p.formatted) {
        k.text(p.formatted, X + 12, ay + 52, { font: 'display', size: 25, color: COLORS.value });
      } else {
        k.line(X + 12, ay + 52, X + 112, ay + 52);
        k.text('€', X + 116, ay + 52, { font: 'semibold', size: 14, color: COLORS.label });
      }
      const wx = X + 140;
      k.line(wx - 10, ay + 10, wx - 10, ay + 62, { color: COLORS.border, width: 0.8 });
      k.text('LA CANTIDAD DE', wx, ay + 18, { font: 'extrabold', size: 7.6, spacing: 0.3 });
      k.field(wx, ay + 38, X + W - 12 - wx, '', p.words, { size: fs, lines: 2, gap: 17 });

      // Concepto
      top = k.section(X, 328, W, 96, 'Concepto: cuota de socio/a', { icon: 'handHeart', band: 19, size: 9 });
      k.text('Cuota:', X + 12, top + 19, { size: fs, color: COLORS.label });
      k.options(X + 46, top + 19, checks(PERIOD_OPTIONS, m.period), { size: fs, gap: 14 });
      k.dateField(X + 12, top + 42, 'Periodo que cubre: del', p.periodFrom, { size: fs, part: 18, year: 30 });
      k.dateField(X + 238, top + 42, 'al', p.periodTo, { size: fs, part: 18, year: 30 });
      k.text('Forma de pago:', X + 12, top + 65, { size: fs, color: COLORS.label });
      k.options(X + 78, top + 65, checks(METHOD_OPTIONS, p.method), { size: fs, gap: 14 });

      // Gracias
      const thanks = data?.thanks || 'Gracias por formar parte de Bigotes: tu cuota se convierte en cuidados para los gatos de Almendralejo.';
      k.rect(X, 434, W, 34, { radius: 17, fill: COLORS.band });
      const { lines, size } = k.wrap(thanks, [W - 40, W - 40], { font: 'semibold', size: 8.4, min: 6.6 });
      lines.forEach((line, i) => {
        k.text(line, X, 434 + (lines.length === 1 ? 21 : 15 + i * (size + 2)), { font: 'semibold', size, color: COLORS.brown, width: W, align: 'center' });
      });

      // Asociación y firma
      associationBlock(k, X + 4, 488, 220, legal);
      const bw = 140;
      k.text('Firma y sello de la asociación', X + W - bw, 486, { size: 7, color: COLORS.label, width: bw, align: 'center' });
      k.signatureBox(X + W - bw, 492, bw, 50);

      k.footer(X + W / 2, 562, 260);
      k.text('Guarda este recibo como justificante de tu cuota.', X, 582, { size: 7, color: COLORS.muted, width: W, align: 'center' });
    },
  ];
}

// ---------------------------------------------------------------------------
// Hoja de inscripción (A5)
// ---------------------------------------------------------------------------

export function memberSignupSheet(data, { legal }) {
  const m = data?.member ?? {};
  const fs = 8.4;
  const privacy = privacyText(legal, 'gestionar su condición de socio o socia, sus cuotas y sus recibos, y enviarle las comunicaciones de la asociación', {
    example: 'por ejemplo, a Hacienda',
  });
  return [
    (k) => {
      a5Header(k, { title: 'HOJA DE\nINSCRIPCIÓN', subtitle: 'SOCIO / SOCIA' });
      k.rect(X, 94, W, 30, { radius: 8, fill: COLORS.soft });
      k.dateField(X + 12, 113, 'FECHA:', m.joinedOn || '', { size: 8, part: 18, year: 30 });
      k.field(X + 220, 113, W - 232, 'SOCIO/A N.º:', m.number ? String(m.number) : '', { size: 8, labelFont: 'bold' });

      let top = k.section(X, 132, W, 122, 'Datos personales', { icon: 'user', band: 19, size: 9 });
      k.field(X + 12, top + 19, W - 24, 'Nombre y apellidos:', m.name, { size: fs });
      k.field(X + 12, top + 38, 170, 'DNI / NIE:', m.dni, { size: fs });
      k.field(X + 192, top + 38, W - 204, 'Teléfono:', m.phone, { size: fs });
      k.field(X + 12, top + 57, W - 24, 'Correo electrónico:', m.email, { size: fs });
      k.field(X + 12, top + 76, W - 24, 'Dirección:', m.address, { size: fs });
      k.field(X + 12, top + 95, W - 24, 'Municipio:', m.municipality, { size: fs });

      top = k.section(X, 262, W, 74, 'Mi cuota', { icon: 'handHeart', band: 19, size: 9 });
      k.text('Importe:', X + 12, top + 20, { size: fs, color: COLORS.label });
      k.line(X + 50, top + 21.5, X + 100, top + 21.5);
      if (m.fee) k.text(m.fee.toLocaleString('es-ES', { minimumFractionDigits: 2 }), X + 52, top + 19.5, { font: 'semibold', size: 9, color: COLORS.value });
      k.text('€', X + 103, top + 20, { size: fs, color: COLORS.label });
      k.options(X + 122, top + 20, checks(PERIOD_OPTIONS, m.period), { size: fs, gap: 11 });
      k.text('Pagaré por:', X + 12, top + 42, { size: fs, color: COLORS.label });
      k.options(X + 62, top + 42, checks(METHOD_OPTIONS, m.method), { size: fs, gap: 14 });

      const ch = k.checkItem(
        X + 4,
        346,
        W - 8,
        'Quiero hacerme socio o socia de Bigotes y pagar esta cuota mientras no me dé de baja (puedo hacerlo cuando quiera avisando a la asociación). Acepto el tratamiento de mis datos que se explica abajo.',
        { size: 7.8 },
      );

      const sy = 346 + ch + 12;
      top = k.section(X, sy, W, 76, 'Firma', { icon: 'penLine', band: 19, size: 9 });
      k.signatureBox(X + 12, top + 8, 180, 44);
      k.field(X + 206, top + 22, W - 218, 'Lugar:', data ? 'Almendralejo' : '', { size: fs });
      k.dateField(X + 206, top + 44, 'Fecha:', '', { size: fs, part: 18, year: 30 });

      const py = sy + 76 + 10;
      k.use('text', 6);
      const ph = k.doc.heightOfString(privacy, { width: W - 8, lineGap: 0.4 });
      k.paragraph(privacy, X + 4, py, W - 8, { size: 6, lineGap: 0.4, color: COLORS.muted });
      k.footer(X + W / 2, Math.min(py + ph + 18, 584), 260);
    },
  ];
}
