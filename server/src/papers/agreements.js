import { COLORS } from './pdf.js';

// Contrato de adopción y compromiso de confidencialidad (A4). Llevan texto
// largo, así que se colocan de arriba abajo y, si no cabe todo, se reduce un
// poco la letra hasta que entra en una hoja.

const SEX = (sex, known) => [
  { label: 'Macho', checked: sex === 'macho' },
  { label: 'Hembra', checked: sex === 'hembra' },
  { label: 'Sin determinar', checked: known && sex === 'desconocido' },
];

/** «él/ella» según el sexo del gato (o las dos formas si no se sabe). */
function pronouns(sex) {
  if (sex === 'macho') return { him: 'él', it: 'lo', o: 'o' };
  if (sex === 'hembra') return { him: 'ella', it: 'la', o: 'a' };
  return { him: 'él/ella', it: 'lo/la', o: 'o/a' };
}

export function adoptionConditions(cat) {
  const p = pronouns(cat?.sex);
  const items = [
    'Me comprometo a ofrecer al gato un hogar seguro, estable y lleno de cariño.',
    'No abandonaré al gato ni lo cederé a terceros sin comunicarlo previamente a la asociación.',
    'Mantendré su identificación (microchip) y comunicaré cualquier cambio de domicilio o de datos de contacto.',
    'Garantizaré su atención veterinaria siempre que sea necesaria.',
  ];
  // Si se entrega sin esterilizar, la esterilización queda como compromiso.
  if (!cat?.sterilized) {
    items.push(
      `Si se entrega sin esterilizar, me comprometo a esterilizarl${p.o} antes del ____ / ____ / ________ (o cuando lo indique la veterinaria) y a enviar el justificante a BIGOTES.`,
    );
  }
  items.push(
    `En caso de que, por cualquier motivo, no pueda seguir haciéndome cargo de ${p.him}, me comprometo a contactar con BIGOTES y devolver${p.it} a la asociación.`,
    'Acepto recibir visitas de seguimiento o contacto periódico para conocer su adaptación.',
    'Declaro que toda la información facilitada es veraz.',
    'He leído y acepto las condiciones de adopción de BIGOTES.',
  );
  return items;
}

/** Texto de protección de datos con los datos legales de la asociación. */
export function privacyText(legal, purpose) {
  const blank = '______________';
  const who = [legal.holder, `CIF ${legal.cif || blank}`, legal.address].filter(Boolean).join(', ');
  const contact = legal.email ? `escribiendo a ${legal.email}` : 'dirigiéndose a la asociación';
  return (
    `Responsable: ${who}. Los datos personales de este documento se tratan con la única finalidad de ${purpose} y cumplir con las obligaciones legales, ` +
    'y no se ceden a terceros salvo obligación legal (por ejemplo, el registro del microchip). Se conservan mientras dure la relación con la asociación y, después, ' +
    `el tiempo que exija la ley. Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad ${contact}, ` +
    'y reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).'
  );
}

/** Cabecera A4 con el logo y, opcionalmente, la caja de número y fecha a la derecha. */
function a4Header(k, { numberLabel, number, date, centered = false }) {
  if (centered) {
    k.logo(172, 20, 252);
    return;
  }
  k.logo(150, 20, 252);
  const bx = 432;
  k.rect(bx, 24, 567 - bx, 76, { radius: 9, fill: COLORS.box });
  k.text(numberLabel, bx + 12, 43, { font: 'extrabold', size: 9, spacing: 0.4 });
  k.field(bx + 12, 61, 567 - bx - 24, '', number, { valueSize: 11 });
  k.text('FECHA', bx + 12, 78, { font: 'extrabold', size: 9, spacing: 0.4 });
  k.dateField(bx + 12, 94, '', date, { part: 24, year: 42 });
}

function titleBand(k, y, title, subtitle) {
  k.rect(28, y, 539, 54, { radius: 18, fill: COLORS.band });
  k.text(title, 28, y + 28, { font: 'display', size: 22, color: COLORS.ink, width: 539, align: 'center', spacing: 4 });
  const sw = k.width(subtitle, 'semibold', 7.6, { characterSpacing: 3 });
  k.text(subtitle, 28, y + 45, { font: 'semibold', size: 7.6, color: COLORS.ink, width: 539, align: 'center', spacing: 3 });
  k.line(297.6 - sw / 2 - 52, y + 42.5, 297.6 - sw / 2 - 10, y + 42.5, { color: COLORS.ink, width: 0.6 });
  k.line(297.6 + sw / 2 + 8, y + 42.5, 297.6 + sw / 2 + 50, y + 42.5, { color: COLORS.ink, width: 0.6 });
  return y + 54;
}

function motto(k, y) {
  k.footer(297.6, y, 380);
  k.text('PROTECCIÓN  •  CUIDADO  •  ORIENTACIÓN CIUDADANA', 28, y + 17, {
    font: 'semibold',
    size: 7.6,
    color: COLORS.accent,
    width: 539,
    align: 'center',
    spacing: 2.2,
  });
}

// ---------------------------------------------------------------------------
// Contrato de adopción
// ---------------------------------------------------------------------------

export function adoptionContract(data, { legal }) {
  const cat = data?.cat ?? {};
  const a = data?.adopter ?? {};
  const contract = data?.contract ?? {};
  const known = Boolean(data?.cat);
  const conditions = adoptionConditions(data?.cat);
  const privacy = privacyText(legal, 'gestionar la adopción y su seguimiento');

  return [
    (k) => {
      const X = 28;
      const W = 539;
      const layout = (size, draw) => {
        const fs = 8.4;
        if (draw) {
          a4Header(k, { numberLabel: 'N.º DE CONTRATO', number: contract.number, date: contract.date });
          titleBand(k, 122, 'CONTRATO DE ADOPCIÓN', 'UN HOGAR RESPONSABLE CAMBIA HISTORIAS');
        }
        let y = 186;
        const half = 262;
        const RX = X + half + 11;
        const RW = W - half - 11;

        // Datos del gato y del adoptante
        if (draw) {
          let top = k.section(X, y, half, 206, 'Datos del gato', { icon: 'cat' });
          k.field(X + 11, top + 18, half - 22, 'Nombre (provisional/definitivo):', cat.name, { size: fs });
          k.field(X + 11, top + 37, half - 22, 'N.º de ficha:', cat.fileNumber, { size: fs });
          k.text('Sexo:', X + 11, top + 56, { size: fs, color: COLORS.label });
          k.options(X + 40, top + 56, SEX(cat.sex, known), { size: fs, gap: 9 });
          k.field(X + 11, top + 75, half - 22, 'Edad aproximada:', cat.age, { size: fs });
          k.field(X + 11, top + 94, half - 22, 'Raza / tipo:', cat.breed, { size: fs });
          k.field(X + 11, top + 113, half - 22, 'Color y rasgos identificativos:', cat.coat, { size: fs, lines: 2, gap: 17 });
          k.field(X + 11, top + 155, half - 22, 'N.º de microchip:', cat.microchipNumber, { size: fs });

          top = k.section(RX, y, RW, 146, 'Datos del adoptante', { icon: 'user' });
          k.field(RX + 11, top + 17, RW - 22, 'Nombre y apellidos:', a.name, { size: fs });
          k.field(RX + 11, top + 34, 116, 'DNI / NIE:', a.dni, { size: fs });
          k.dateField(RX + 134, top + 34, 'Fecha nac.:', a.birthDate, { size: fs, part: 14, year: 24 });
          k.field(RX + 11, top + 51, RW - 22, 'Dirección:', a.address, { size: fs });
          k.field(RX + 11, top + 68, 160, 'Localidad:', a.municipality, { size: fs });
          k.field(RX + 178, top + 68, RW - 189, 'C.P.:', a.postalCode, { size: fs });
          k.field(RX + 11, top + 85, RW - 22, 'Provincia:', a.province, { size: fs });
          k.field(RX + 11, top + 102, RW - 22, 'Teléfono:', a.phone, { size: fs });
          k.field(RX + 11, top + 119, RW - 22, 'Correo electrónico:', a.email, { size: fs });

          top = k.section(RX, y + 154, RW, 52, 'Contacto alternativo', { icon: 'phone', note: '(opcional)' });
          k.field(RX + 11, top + 13, RW - 22, 'Nombre y apellidos:', a.altContactName, { size: fs });
          k.field(RX + 11, top + 27, 132, 'Teléfono:', a.altContactPhone, { size: fs });
          k.field(RX + 150, top + 27, RW - 161, 'Relación:', a.altContactRelation, { size: fs });
        }
        y += 206 + 9;

        // Condiciones
        const textW = W - 150;
        k.use('text', size);
        const heights = conditions.map((text) => Math.max(8, k.doc.heightOfString(text, { width: textW - 15, lineGap: 1 })));
        const condH = 21 + 10 + heights.reduce((s, h) => s + h + 5, 0) + 4;
        if (draw) {
          const top = k.section(X, y, W, condH, 'Condiciones de adopción', { icon: 'fileText' });
          let cy = top + 9;
          conditions.forEach((text, i) => {
            k.checkItem(X + 12, cy, textW, text, { size, lineGap: 1 });
            cy += heights[i] + 5;
          });
          // Adorno: gato y corazón.
          const iy = top + Math.max(4, (condH - 21 - 110) / 2);
          k.doc.save().circle(X + W - 70, iy + 70, 44).fill(COLORS.box).restore();
          k.icon('cat', X + W - 120, iy + 18, 100, { color: COLORS.brown, stroke: 1.1 });
          k.icon('heart', X + W - 44, iy, 22, { color: COLORS.brown, stroke: 1.6 });
        }
        y += condH + 9;

        // Documentación y firmas
        const docsH = 108;
        if (draw) {
          let top = k.section(X, y, half, docsH, 'Documentación que se entrega', { icon: 'folderOpen' });
          const docs = [
            ['Contrato de adopción (este documento)', true],
            ['Cartilla / pasaporte', Boolean(cat.vaccinated)],
            ['Justificante de microchip', Boolean(cat.microchipped)],
            ['Hoja informativa de cuidados', false],
          ];
          docs.forEach(([label, checked], i) => k.checkItem(X + 12, top + 9 + i * 15.5, half - 24, label, { checked, size: fs }));
          k.checkbox(X + 12, top + 9 + 4 * 15.5 + 0.5, false);
          k.field(X + 27, top + 9 + 4 * 15.5 + 7.5, half - 39, 'Otro:', '', { size: fs });

          top = k.section(RX, y, RW, docsH, 'Firmas', { icon: 'penLine' });
          const bw = (RW - 34) / 2;
          k.text('Firma del adoptante:', RX + 12, top + 14, { size: 7.8, color: COLORS.label, width: bw, align: 'center' });
          k.text('Firma y sello Asociación BIGOTES:', RX + 22 + bw, top + 14, { size: 7.8, color: COLORS.label, width: bw, align: 'center' });
          k.signatureBox(RX + 12, top + 20, bw, 44);
          k.signatureBox(RX + 22 + bw, top + 20, bw, 44);
          k.field(RX + 12, top + 79, 118, 'Lugar:', contract.place, { size: fs });
          k.dateField(RX + 138, top + 79, 'Fecha:', contract.date, { size: fs, part: 15, year: 28 });
        }
        y += docsH + 9;

        // Protección de datos
        k.use('text', size - 0.9);
        const privH = 21 + 8 + k.doc.heightOfString(privacy, { width: W - 24, lineGap: 0.8 }) + 7;
        if (draw) {
          const top = k.section(X, y, W, privH, 'Protección de datos', { icon: 'lock' });
          k.paragraph(privacy, X + 12, top + 7, W - 24, { size: size - 0.9, lineGap: 0.8, color: COLORS.label });
        }
        y += privH + 12;
        if (draw) motto(k, y);
        return y + 22;
      };
      let size = 8.4;
      while (size > 6.6 && layout(size, false) > 838) size -= 0.1;
      layout(size, true);
    },
  ];
}

// ---------------------------------------------------------------------------
// Compromiso de confidencialidad
// ---------------------------------------------------------------------------

export const CONFIDENTIALITY = {
  intro:
    'Colaborar con BIGOTES supone conocer datos de otras personas (familias adoptantes, casas de acogida, voluntariado, donantes o vecinos que nos avisan de un gato) e información interna de la asociación. Para cuidarlos igual que cuidamos a los gatos, me comprometo a:',
  items: [
    'Usar esos datos solo para las tareas de la asociación que tenga encomendadas, y nunca para fines propios.',
    'No contarlos, copiarlos ni compartirlos con nadie ajeno a la asociación, ni publicarlos en redes sociales o grupos de mensajería.',
    'No publicar fotos ni datos que permitan localizar a familias adoptantes, casas de acogida o colonias sin permiso de la asociación.',
    'Guardar con cuidado los papeles (contratos, fichas, partes) y no hacer fotos de documentos con datos personales salvo para enviarlos a la asociación.',
    'Proteger mi acceso al panel: no compartir mi contraseña y cerrar la sesión en dispositivos que no sean míos.',
    'Avisar enseguida a la asociación si pierdo el móvil, envío algo por error o creo que alguien ha podido ver datos que no debía.',
    'Al dejar de colaborar, devolver o destruir los documentos y borrar los datos de la asociación que tenga en mis dispositivos.',
  ],
  closing: 'Este compromiso sigue vigente aunque deje de colaborar con la asociación.',
};

export const CONFIDENTIALITY_ROLES = {
  admin: 'Bigote mayor',
  cuidabigotes: 'Cuidabigotes',
  voluntariado: 'Voluntariado',
  acogida: 'Casa de acogida',
};

export function confidentialityAgreement(person, { legal }) {
  const p = person ?? {};
  const privacy = privacyText(legal, 'gestionar su colaboración con la asociación');
  return [
    (k) => {
      const X = 28;
      const W = 539;
      const layout = (size, draw) => {
        const fs = 8.6;
        if (draw) {
          a4Header(k, { centered: true });
          titleBand(k, 124, 'COMPROMISO DE CONFIDENCIALIDAD', 'CUIDAMOS DE LOS GATOS Y DE LAS PERSONAS');
        }
        let y = 190;
        if (draw) {
          const top = k.section(X, y, W, 104, 'Datos de la persona', { icon: 'user' });
          k.field(X + 12, top + 19, W - 24, 'Nombre y apellidos:', p.name, { size: fs });
          k.field(X + 12, top + 38, 220, 'DNI / NIE:', p.dni, { size: fs });
          k.field(X + 244, top + 38, W - 256, 'Teléfono:', p.phone, { size: fs });
          k.field(X + 12, top + 57, W - 24, 'Correo electrónico:', p.email, { size: fs });
          k.text('Colabora como:', X + 12, top + 72, { size: fs, color: COLORS.label });
          k.options(
            X + 82,
            top + 72,
            Object.entries(CONFIDENTIALITY_ROLES).map(([value, label]) => ({ label, checked: p.role === value })),
            { size: fs, gap: 14 },
          );
        }
        y += 104 + 10;

        k.use('text', size);
        const introH = k.doc.heightOfString(CONFIDENTIALITY.intro, { width: W - 24, lineGap: 1.2 });
        const heights = CONFIDENTIALITY.items.map((t) => k.doc.heightOfString(t, { width: W - 46, lineGap: 1.2 }));
        k.use('bold', size);
        const closingH = k.doc.heightOfString(CONFIDENTIALITY.closing, { width: W - 24 });
        const bodyH = 21 + 10 + introH + 8 + heights.reduce((s, h) => s + h + 6, 0) + 4 + closingH + 10;
        if (draw) {
          const top = k.section(X, y, W, bodyH, 'Mi compromiso', { icon: 'shieldCheck' });
          let cy = top + 10;
          cy += k.paragraph(CONFIDENTIALITY.intro, X + 12, cy, W - 24, { size, lineGap: 1.2, color: COLORS.label }) + 8;
          CONFIDENTIALITY.items.forEach((text, i) => {
            k.paw(X + 14, cy + 0.5, 9, COLORS.accent);
            k.paragraph(text, X + 34, cy, W - 46, { size, lineGap: 1.2, color: COLORS.label });
            cy += heights[i] + 6;
          });
          k.paragraph(CONFIDENTIALITY.closing, X + 12, cy + 4, W - 24, { size, font: 'bold', color: COLORS.ink });
        }
        y += bodyH + 10;

        const signH = 118;
        if (draw) {
          const top = k.section(X, y, W, signH, 'Firmas', { icon: 'penLine' });
          const bw = 200;
          k.text('Firma de la persona:', X + 12, top + 15, { size: 8, color: COLORS.label, width: bw, align: 'center' });
          k.text('Firma y sello Asociación BIGOTES:', X + W - 12 - bw, top + 15, { size: 8, color: COLORS.label, width: bw, align: 'center' });
          k.signatureBox(X + 12, top + 22, bw, 52);
          k.signatureBox(X + W - 12 - bw, top + 22, bw, 52);
          k.field(X + 12, top + 90, 200, 'Lugar:', p.place, { size: fs });
          k.dateField(X + W - 12 - bw, top + 90, 'Fecha:', p.date, { size: fs });
        }
        y += signH + 10;

        k.use('text', size - 1);
        const privH = 21 + 8 + k.doc.heightOfString(privacy, { width: W - 24, lineGap: 0.8 }) + 7;
        if (draw) {
          const top = k.section(X, y, W, privH, 'Protección de datos', { icon: 'lock' });
          k.paragraph(privacy, X + 12, top + 7, W - 24, { size: size - 1, lineGap: 0.8, color: COLORS.label });
        }
        y += privH + 16;
        if (draw) motto(k, y);
        return y + 26;
      };
      let size = 9.2;
      while (size > 7 && layout(size, false) > 834) size -= 0.1;
      layout(size, true);
    },
  ];
}
