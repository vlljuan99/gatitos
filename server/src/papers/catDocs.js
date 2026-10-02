import { COLORS, formatDate } from './pdf.js';

// Papeles de cada gato: ficha del gato (A4), ficha de seguimiento (A5),
// acuerdo de acogida (A5) y parte de atención veterinaria (A5 apaisado).
// Reciben los datos ya preparados (papers/data.js) o null para sacarlos en
// blanco. Copian el diseño de los originales de la asociación.

const SEX = (sex) => [
  { label: 'Macho', checked: sex === 'macho' },
  { label: 'Hembra', checked: sex === 'hembra' },
];
const triOptions = (value, unknown = 'Desconocido') => [
  { label: 'Sí', checked: value === 'si' },
  { label: 'No', checked: value === 'no' },
  ...(unknown ? [{ label: unknown, checked: false }] : []),
];
const yes = (flag) => (flag ? 'si' : '');

/** Cabecera de las hojas A5: logo a la izquierda y caja con el título. */
function a5Header(k, { title, subtitle, x = 14, w = 392, compact = false }) {
  k.logo(x + 4, compact ? 12 : 14, compact ? 160 : 176);
  const bx = x + 196;
  const bw = w - 196;
  const lines = title.split('\n');
  const h = compact ? 62 : subtitle ? 72 : 62;
  k.rect(bx, 12, bw, h, { radius: 9, fill: COLORS.band });
  const size = compact ? 18 : lines.length > 1 ? 20 : 18;
  lines.forEach((line, i) => {
    k.text(line, bx, 12 + (compact ? 23 : 26) + i * (size + 1), { font: 'display', size, color: COLORS.brown, width: bw, align: 'center', spacing: 0.6 });
  });
  if (subtitle) k.text(subtitle, bx, 12 + h - (compact ? 7 : 9), { font: 'semibold', size: 7.4, color: COLORS.brown, width: bw, align: 'center', spacing: 1.6 });
  return 12 + h;
}

// ---------------------------------------------------------------------------
// Ficha del gato (A4)
// ---------------------------------------------------------------------------

export function catFile(cat) {
  const c = cat ?? {};
  const intake = c.intake ?? {};
  const colony = c.colony ?? {};
  const vet = c.vet ?? {};
  const foster = c.foster ?? {};
  const outcome = c.outcome ?? {};
  const situation = c.situation ?? {};

  return [
    (k) => {
      const X = 28;
      const W = 539;
      const R = X + W;
      // Cabecera
      k.logo(122, 22, 262);
      k.rect(418, 26, R - 418, 78, { radius: 9, fill: COLORS.box });
      k.text('N.º DE FICHA', 430, 46, { font: 'extrabold', size: 9.5, spacing: 0.4 });
      k.field(430, 64, R - 442, '', c.fileNumber, { valueSize: 11 });
      k.text('FECHA DE ENTRADA', 430, 82, { font: 'extrabold', size: 9.5, spacing: 0.4 });
      k.dateField(430, 98, '', c.arrivedAt, { part: 26, year: 46 });
      k.text('Pequeños gestos, grandes cambios', 418, 120, { font: 'italic', size: 10, color: COLORS.brown, width: R - 418, align: 'right' });

      // Datos de entrada
      let y = k.section(X, 130, W, 98, 'Datos de entrada', { icon: 'mapPin' });
      k.field(X + 12, y + 18, 262, 'Lugar exacto de recogida:', intake.place);
      k.field(X + 290, y + 18, W - 302, 'Nombre provisional:', c.name);
      k.field(X + 12, y + 35, W - 24, 'Persona que lo recoge/localiza:', intake.by);
      k.field(X + 12, y + 52, W - 24, 'Teléfono de contacto:', intake.phone);
      k.field(X + 12, y + 69, W - 24, 'Motivo de la intervención:', intake.reason);

      // Identificación y colonia
      const half = (W - 10) / 2;
      const X2 = X + half + 10;
      y = k.section(X, 238, half, 162, 'Identificación del gato', { icon: 'cat' });
      k.text('Sexo:', X + 12, y + 18, { color: COLORS.label, size: 8.5 });
      k.options(X + 42, y + 18, [...SEX(c.sex), { label: 'Sin determinar', checked: Boolean(cat) && c.sex === 'desconocido' }], { gap: 10 });
      k.field(X + 12, y + 37, half - 24, 'Edad aproximada:', c.age);
      k.field(X + 12, y + 56, half - 24, 'Raza / tipo:', c.breed);
      k.field(X + 12, y + 75, half - 24, 'Color y manchas identificativas:', c.coat, { lines: 2, gap: 16 });
      k.text('¿Tiene microchip?', X + 12, y + 114, { color: COLORS.label, size: 8.5 });
      k.options(X + 92, y + 114, [
        { label: 'Sí', checked: Boolean(c.microchipped) },
        { label: 'No', checked: false },
        { label: 'No comprobado', checked: false },
      ], { gap: 10 });
      k.field(X + 12, y + 133, half - 24, 'N.º de microchip:', c.microchipNumber);

      y = k.section(X2, 238, half, 162, 'Procedencia / colonia', { icon: 'pawPrint' });
      k.text('¿Pertenece a una colonia?', X2 + 12, y + 18, { color: COLORS.label, size: 8.5 });
      k.options(X2 + 122, y + 18, triOptions(colony.member), { gap: 8 });
      k.field(X2 + 12, y + 37, half - 24, 'Nombre o ubicación de la colonia:', colony.name, { lines: 2, gap: 16 });
      k.field(X2 + 12, y + 72, half - 24, 'Persona responsable / alimentadora:', colony.caretaker, { lines: 2, gap: 16 });
      k.text('¿Está esterilizado?', X2 + 12, y + 114, { color: COLORS.label, size: 8.5 });
      k.options(X2 + 100, y + 114, triOptions(yes(c.sterilized)), { gap: 8 });
      k.text('¿Presenta marcaje auricular (CER)?', X2 + 12, y + 133, { color: COLORS.label, size: 8.5 });
      k.options(X2 + 156, y + 133, triOptions(colony.earTipped, ''), { gap: 10 });

      // Atención veterinaria
      y = k.section(X, 410, W, 122, 'Atención veterinaria', { icon: 'stethoscope' });
      const colW = W / 2 - 22;
      const RX = X + W / 2 + 10;
      k.line(X + W / 2, y + 8, X + W / 2, y + 95, { color: COLORS.border, width: 0.8 });
      k.text('¿Ha sido llevado al veterinario?', X + 12, y + 18, { color: COLORS.label, size: 8.5 });
      k.options(X + 142, y + 18, [
        { label: 'Sí', checked: Boolean(c.hasVetVisits) },
        { label: 'No', checked: false },
      ]);
      k.dateField(X + 12, y + 37, 'Fecha:', vet.date);
      k.field(X + 12, y + 56, colW, 'Clínica veterinaria:', vet.clinic);
      k.field(X + 12, y + 75, colW, 'Estado general / diagnóstico:', vet.diagnosis, { lines: 2, gap: 16 });
      k.field(RX, y + 18, colW, 'Pruebas realizadas:', vet.tests, { lines: 2, gap: 16 });
      k.field(RX, y + 53, colW, 'Tratamiento:', vet.treatment);
      k.field(RX, y + 72, colW, 'Medicación y pauta:', vet.medication);
      k.dateField(RX, y + 91, 'Próxima revisión:', vet.nextCheck);

      // Acogida y seguimiento
      y = k.section(X, 542, W, 118, 'Acogida y seguimiento', { icon: 'house' });
      k.field(X + 12, y + 18, 300, 'Casa de acogida:', foster.name);
      k.field(X + 324, y + 18, W - 336, 'Teléfono:', foster.phone);
      k.dateField(X + 12, y + 37, 'Fecha de entrada:', foster.since);
      k.field(X + 12, y + 56, W - 24, 'Observaciones de comportamiento:', c.personality);
      k.field(X + 12, y + 75, W - 24, 'Evolución / incidencias:', '', { lines: 2, gap: 16 });

      // Situación final
      y = k.section(X, 670, W, 118, 'Situación final', { icon: 'circleCheck' });
      const end = k.options(X + 12, y + 18, [
        { label: 'En tratamiento', checked: Boolean(situation.treatment) },
        { label: 'En acogida', checked: Boolean(situation.foster) },
        { label: 'En adopción', checked: Boolean(situation.adoption) },
        { label: 'Adoptado', checked: Boolean(situation.adopted) },
        { label: 'Devuelto a su colonia', checked: Boolean(situation.colony) },
        { label: 'Otro:', checked: false },
      ], { gap: 9 });
      k.line(end + 3, y + 19.5, R - 12, y + 19.5);
      k.dateField(X + 12, y + 37, 'Fecha de salida / adopción:', outcome.date);
      k.field(X + 12, y + 56, W - 24, 'Adoptante / responsable final:', outcome.person);
      k.field(X + 12, y + 75, W - 24, 'Observaciones:', '', { lines: 2, gap: 16 });

      k.footer(297.6, 805, 330, 'Cada gato cuenta');
    },
  ];
}

// ---------------------------------------------------------------------------
// Ficha de seguimiento (A5): historial con fecha y notas
// ---------------------------------------------------------------------------

const ROW_H = 23;
const ROWS_PER_PAGE = 14;
const DATE_W = 64;

/** Reparte las anotaciones en filas de la tabla (cada una puede ocupar varias). */
function historyRows(k, entries, textWidth) {
  const rows = [];
  for (const entry of entries) {
    const { lines } = k.wrap(entry.text, Array(8).fill(textWidth), { font: 'text', size: 7.6, min: 7.6 });
    for (let i = 0; i < lines.length; i += 2) {
      rows.push({ date: i === 0 ? formatDate(entry.date) : '', lines: lines.slice(i, i + 2), first: i === 0 });
    }
  }
  return rows;
}

export function followUpSheet(cat, { k }) {
  const c = cat ?? {};
  const X = 14;
  const W = 392;
  const textWidth = W - DATE_W - 16;
  const rows = historyRows(k, c.history ?? [], textWidth);
  const pages = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) pages.push(rows.slice(i, i + ROWS_PER_PAGE));
  // Siempre quedan al menos 4 filas libres para seguir apuntando a mano.
  if (pages.length === 0 || pages.at(-1).length > ROWS_PER_PAGE - 4) pages.push([]);

  return pages.map((pageRows, p) => (kk) => {
    a5Header(kk, { title: 'FICHA DE\nSEGUIMIENTO' });
    kk.rect(X, 84, W, 52, { radius: 8, fill: COLORS.soft });
    kk.field(X + 10, 104, 236, 'GATO:', c.name, { size: 8, labelFont: 'bold' });
    kk.field(X + 256, 104, W - 266, 'N.º DE FICHA:', c.fileNumber, { size: 8, labelFont: 'bold' });
    kk.field(X + 10, 125, 236, 'ACOGIDA:', c.foster?.name, { size: 8, labelFont: 'bold' });
    kk.text('ENTRADA:', X + 256, 125, { font: 'bold', size: 8, color: COLORS.label });
    kk.dateField(X + 297, 125, '', c.arrivedAt, { size: 7.5, part: 17, year: 28 });

    // Tabla
    const top = 146;
    const head = 20;
    const bodyTop = top + head;
    const tableH = head + ROWS_PER_PAGE * ROW_H;
    kk.rect(X, top, W, tableH, { radius: 7, fill: COLORS.white, stroke: COLORS.border });
    kk.doc.save();
    kk.doc.roundedRect(X, top, W, tableH, 7).clip();
    kk.doc.rect(X, top, W, head).fill(COLORS.band);
    kk.doc.restore();
    kk.text('FECHA', X, top + 13.5, { font: 'extrabold', size: 8, width: DATE_W, align: 'center' });
    kk.text('NOTAS / OBSERVACIONES / COSAS A RECORDAR', X + DATE_W, top + 13.5, { font: 'extrabold', size: 8, width: W - DATE_W, align: 'center' });
    kk.line(X + DATE_W, top, X + DATE_W, top + tableH, { color: COLORS.border, width: 0.8 });
    for (let i = 1; i < ROWS_PER_PAGE; i += 1) kk.line(X, bodyTop + i * ROW_H, X + W, bodyTop + i * ROW_H, { color: COLORS.border, width: 0.7 });
    pageRows.forEach((row, i) => {
      const ry = bodyTop + i * ROW_H;
      if (row.date) kk.text(row.date, X, ry + 14.5, { font: 'semibold', size: 7.6, color: COLORS.value, width: DATE_W, align: 'center' });
      const single = row.lines.length === 1;
      row.lines.forEach((line, j) => {
        kk.text(line, X + DATE_W + 8, ry + (single ? 14.5 : 10 + j * 9), { size: 7.6, color: COLORS.value });
      });
    });
    if (pages.length > 1) {
      kk.text(`Hoja ${p + 1} de ${pages.length}`, X, 486 + 15, { size: 6.5, color: COLORS.muted, width: W, align: 'right' });
    }

    // Pendiente
    const py = 504;
    kk.section(X, py, W, 80, 'Pendiente', { band: 18, size: 8.5 });
    const { lines } = kk.wrap(p === 0 ? c.pending : '', [W - 24, W - 24, W - 24], { font: 'semibold', size: 8, min: 6.5 });
    for (let i = 0; i < 3; i += 1) {
      const ly = py + 37 + i * 17;
      kk.line(X + 12, ly + 1.5, X + W - 12, ly + 1.5);
      if (lines[i]) kk.text(lines[i], X + 14, ly - 0.5, { font: 'semibold', size: 8, color: COLORS.value });
    }
  });
}

// ---------------------------------------------------------------------------
// Acuerdo de acogida (A5)
// ---------------------------------------------------------------------------

export const FOSTER_AGREEMENT = {
  agreement: [
    'La persona firmante recibe en acogida al gato indicado, comprometiéndose a proporcionarle un entorno seguro, los cuidados necesarios y una atención adecuada durante el tiempo que permanezca bajo su responsabilidad.',
    'El gato continúa siendo responsabilidad de la Asociación BIGOTES y la acogida no supone en ningún caso una adopción ni la transmisión de su titularidad.',
    'La persona de acogida se compromete a no entregar, ceder ni trasladar el gato a otra persona sin autorización previa de la asociación.',
    'Cualquier problema de salud, cambio importante de comportamiento o situación que pueda afectar al bienestar del animal deberá comunicarse a la asociación.',
    'Las actuaciones veterinarias a cargo de la asociación deberán realizarse siguiendo el procedimiento establecido por esta (con su parte de atención veterinaria), salvo situaciones de urgencia.',
  ],
  diffusion: [
    { text: 'La persona de acogida se compromete a mantener una comunicación periódica con la asociación y a facilitar fotografías y vídeos del gato durante su estancia, procurando que sean imágenes claras, cuidadas y útiles para su difusión y búsqueda de adopción.' },
    { text: 'Las fotografías y vídeos facilitados serán utilizados por la asociación para mostrar al gato y favorecer su adopción a través de sus redes sociales, página web y otros medios de difusión.', bold: true },
    { text: 'La persona de acogida colaborará activamente en la creación de este material, mostrando la evolución, personalidad y día a día del gato.' },
    { text: 'La acogida forma parte también del proceso de preparación del gato para su adopción, por lo que su evolución y su día a día deben poder ser conocidos y difundidos por la asociación.' },
  ],
  duration:
    'La acogida será temporal, sin una fecha límite determinada, y podrá finalizar por decisión de la asociación o de la persona de acogida, comunicándolo con antelación siempre que sea posible.',
};

export function fosterAgreement(cat, { legal }) {
  const c = cat ?? {};
  const f = c.foster ?? {};
  const X = 14;
  const W = 392;
  const BAND = 17;
  const FS = 7.6;
  const privacy = `Protección de datos: ${legal.holder} usa estos datos solo para gestionar la acogida y no los cede salvo obligación legal. Tus derechos y más información: ${legal.web}/privacidad${legal.email ? ` o ${legal.email}` : ''}.`;
  const blocks = [
    ['Acuerdo', FOSTER_AGREEMENT.agreement.map((text) => ({ text }))],
    ['Compromiso con el seguimiento y la difusión', FOSTER_AGREEMENT.diffusion],
    ['Duración', [{ text: FOSTER_AGREEMENT.duration }]],
  ];

  return [
    (k) => {
      const measure = (item, size) => {
        k.use(item.bold ? 'bold' : 'text', size);
        return k.doc.heightOfString(item.text, { width: W - 22, lineGap: 0.6 });
      };
      const privacyHeight = () => {
        k.use('text', 5.6);
        return k.doc.heightOfString(privacy, { width: W - 4, lineGap: 0.3 });
      };
      const blockHeight = (items, size) => BAND + 6 + items.reduce((sum, item) => sum + measure(item, size) + 2.5, 0) + 3;
      // Altura total con una letra dada: se reduce hasta que todo cabe en la hoja.
      const GAP = 5;
      const total = (size) =>
        80 + 56 + GAP + 70 + GAP + blocks.reduce((sum, [, items]) => sum + blockHeight(items, size) + GAP, 0) + 58 + 4 + privacyHeight();
      let size = 7.4;
      while (size > 6 && total(size) > 590) size -= 0.1;

      a5Header(k, { title: 'ACUERDO\nDE ACOGIDA', subtitle: 'CASA DE ACOGIDA TEMPORAL', compact: true });
      let y = 80;
      let top = k.section(X, y, W, 56, 'Datos del gato', { band: BAND, size: 8.6 });
      k.field(X + 11, top + 12, 232, 'NOMBRE:', c.name, { size: FS });
      k.field(X + 256, top + 12, W - 267, 'N.º DE FICHA:', c.fileNumber, { size: FS });
      k.text('SEXO:', X + 11, top + 24, { size: FS, color: COLORS.label });
      k.options(X + 40, top + 24, SEX(c.sex), { size: FS, box: 7.5, gap: 16 });
      k.field(X + 256, top + 24, W - 267, 'EDAD APROX.:', c.age, { size: FS });
      k.dateField(X + 11, top + 36, 'FECHA DE ENTRADA EN ACOGIDA:', f.since, { size: FS });
      y += 56 + GAP;

      top = k.section(X, y, W, 70, 'Datos de la persona de acogida', { band: BAND, size: 8.6 });
      k.field(X + 11, top + 12, W - 22, 'NOMBRE Y APELLIDOS:', f.name, { size: FS });
      k.field(X + 11, top + 24, 200, 'DNI / NIE:', f.dni, { size: FS });
      k.field(X + 222, top + 24, W - 233, 'TELÉFONO:', f.phone, { size: FS });
      k.field(X + 11, top + 36, W - 22, 'DIRECCIÓN:', f.address, { size: FS });
      k.field(X + 11, top + 48, W - 22, 'CORREO ELECTRÓNICO:', f.email, { size: FS });
      y += 70 + GAP;

      for (const [title, items] of blocks) {
        const h = blockHeight(items, size);
        let py = k.section(X, y, W, h, title, { band: BAND, size: 8.6 }) + 6;
        for (const item of items) {
          k.paragraph(item.text, X + 11, py, W - 22, { size, lineGap: 0.6, font: item.bold ? 'bold' : 'text', color: COLORS.label });
          py += measure(item, size) + 2.5;
        }
        y += h + GAP;
      }

      const signH = 58;
      const sw = 252;
      k.section(X, y, sw, signH, 'Firma de la persona de acogida', { band: BAND, size: 8.6 });
      k.field(X + 11, y + BAND + 12, sw - 22, 'Nombre y apellidos:', f.name, { size: FS });
      k.field(X + 11, y + BAND + 26, sw - 22, 'Firma:', '', { size: FS });
      k.dateField(X + 11, y + BAND + 38, 'Fecha:', f.since, { size: FS });
      k.rect(X + sw + 8, y, W - sw - 8, signH, { radius: 7, fill: COLORS.box });
      k.paragraph(
        'Al firmar este documento manifiesto que he leído, comprendo y acepto las condiciones del acuerdo de acogida.',
        X + sw + 16,
        y + 8,
        W - sw - 48,
        { size: 6.8, lineGap: 0.6, color: COLORS.label },
      );
      k.icon('cat', X + W - 28, y + signH - 27, 20, { color: COLORS.brown, stroke: 1.8 });
      y += signH + 4;
      k.paragraph(privacy, X + 2, y, W - 4, { size: 5.6, lineGap: 0.3, color: COLORS.muted });
    },
  ];
}

// ---------------------------------------------------------------------------
// Parte de atención veterinaria (A5 apaisado)
// ---------------------------------------------------------------------------

export function vetReport(visit, cat) {
  const c = cat ?? {};
  const v = visit ?? {};
  return [
    (k) => {
      const X = 16;
      const W = 563;
      k.logo(X + 4, 18, 172);
      // Título y número
      k.rect(206, 12, 252, 70, { radius: 9, fill: COLORS.band });
      k.text('PARTE DE ATENCIÓN', 206, 38, { font: 'display', size: 17.5, color: COLORS.brown, width: 252, align: 'center', spacing: 0.4 });
      k.text('VETERINARIA', 206, 57, { font: 'display', size: 17.5, color: COLORS.brown, width: 252, align: 'center', spacing: 0.4 });
      k.text('AUTORIZACIÓN Y REGISTRO', 206, 74, { font: 'semibold', size: 7.2, color: COLORS.brown, width: 252, align: 'center', spacing: 1.8 });
      k.rect(466, 12, X + W - 466, 70, { radius: 9, fill: COLORS.box });
      k.text('N.º DE PARTE', 476, 27, { font: 'bold', size: 8 });
      k.field(476, 43, X + W - 486, '', v.number, { valueSize: 10.5 });
      k.text('FECHA', 476, 59, { font: 'bold', size: 8 });
      k.dateField(476, 74, '', v.date, { size: 8, part: 18, year: 30 });

      const LW = 268;
      const RX = X + LW + 10;
      const RW = W - LW - 10;
      const fs = 8.2;
      // Datos del gato
      let y = k.section(X, 92, LW, 142, 'Datos del gato', { band: 19, size: 9 });
      k.field(X + 11, y + 17, LW - 22, 'Nombre:', c.name, { size: fs });
      k.field(X + 11, y + 34, LW - 22, 'N.º de ficha:', c.fileNumber, { size: fs });
      k.text('Sexo:', X + 11, y + 52, { size: fs, color: COLORS.label });
      k.options(X + 42, y + 52, SEX(c.sex), { size: fs, gap: 22 });
      k.field(X + 11, y + 69, LW - 22, 'Edad aproximada:', c.age, { size: fs });
      const marks = [c.coat, c.microchipNumber && `Microchip ${c.microchipNumber}`].filter(Boolean).join(' · ');
      k.field(X + 11, y + 86, LW - 22, 'Color y rasgos identificativos:', marks, { size: fs, lines: 2, gap: 17 });

      // Persona que lo lleva
      y = k.section(X, 242, LW, 64, 'Persona que lleva al gato', { band: 19, size: 9 });
      k.field(X + 11, y + 17, LW - 22, 'Nombre y apellidos:', v.carrierName, { size: fs });
      k.field(X + 11, y + 35, LW - 22, 'Teléfono:', v.carrierPhone, { size: fs });

      // Importe
      y = k.section(X, 314, LW, 54, 'Importe', { band: 19, size: 9, note: '(opcional)' });
      k.line(X + 14, y + 25, X + LW - 32, y + 25);
      k.text('€', X + LW - 26, y + 26, { font: 'semibold', size: 13, color: COLORS.label });

      // Atención realizada (la escribe la clínica)
      y = k.section(RX, 92, RW, 168, 'Atención realizada', { band: 19, size: 9 });
      for (let i = 0; i < 8; i += 1) k.line(RX + 12, y + 18 + i * 17.5, RX + RW - 12, y + 18 + i * 17.5);

      // Firma y sello de la clínica
      y = k.section(RX, 268, RW, 100, 'Firma y sello de la clínica', { band: 19, size: 9 });
      k.signatureBox(RX + 12, y + 8, 118, 66);
      k.text('Nombre del veterinario/a:', RX + 140, y + 17, { size: 7.8, color: COLORS.label });
      k.line(RX + 140, y + 36, RX + RW - 12, y + 36);
      k.dateField(RX + 140, y + 64, 'Fecha:', '', { size: 7.8, part: 18, year: 30 });

      // Aviso
      k.rect(X + 6, 378, W - 12, 26, { radius: 13, fill: COLORS.band });
      k.text(
        'SIN ESTE PARTE, LA ATENCIÓN NO CORRE A CARGO DE LA ASOCIACIÓN Y SE COBRARÁ APARTE, SALVO URGENCIA.',
        X + 6,
        394,
        { font: 'bold', size: 7.3, color: COLORS.brown, width: W - 12, align: 'center', spacing: 0.9 },
      );
    },
  ];
}
