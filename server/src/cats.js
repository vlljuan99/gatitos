import { db } from './db.js';
import { videoUrls } from './videos.js';

// «colonia» es un gato de colonia que se devolvió a su sitio tras atenderlo
// (captura, esterilización y retorno): se registra en el panel, pero no sale
// en la web. Igual que «borrador», nunca es público.
export const CAT_STATUSES = ['borrador', 'disponible', 'reservado', 'adoptado', 'colonia'];
export const PUBLIC_STATUSES = ['disponible', 'reservado', 'adoptado'];
/** Para consultas SQL: «'disponible', 'reservado', 'adoptado'». */
export const PUBLIC_STATUSES_SQL = PUBLIC_STATUSES.map((s) => `'${s}'`).join(', ');

// Etiquetas de carácter que el panel ofrece con un toque. Se guardan como
// texto, así que se pueden añadir más sin migraciones.
export const PERSONALITY_TAGS = [
  'mimoso',
  'juguetón',
  'tranquilo',
  'curioso',
  'tímido',
  'charlatán',
  'independiente',
  'dormilón',
  'aventurero',
  'glotón',
  'sociable',
  'cariñoso con niños',
];

export function photoUrls(fileKey) {
  const base = `/uploads/gatitos/${fileKey}`;
  return { sm: `${base}-sm.webp`, lg: `${base}-lg.webp`, og: `${base}-og.jpg` };
}

export function photosFor(catIds) {
  if (catIds.length === 0) return new Map();
  const rows = db
    .prepare(
      `SELECT * FROM cat_photos WHERE cat_id IN (${catIds.map(() => '?').join(',')}) ORDER BY position, id`,
    )
    .all(...catIds);
  const byCat = new Map(catIds.map((id) => [id, []]));
  for (const row of rows) {
    byCat.get(row.cat_id).push({ id: row.id, width: row.width, height: row.height, ...photoUrls(row.file_key) });
  }
  return byCat;
}

/**
 * Vídeos por gatito. La web solo ve los que están listos; el panel ve también
 * los que se están preparando o han fallado, para poder quitarlos.
 */
export function videosFor(catIds, { admin = false } = {}) {
  if (catIds.length === 0) return new Map();
  const rows = db
    .prepare(
      `SELECT * FROM cat_videos WHERE cat_id IN (${catIds.map(() => '?').join(',')})
       ${admin ? '' : "AND status = 'listo'"} ORDER BY position, id`,
    )
    .all(...catIds);
  const byCat = new Map(catIds.map((id) => [id, []]));
  for (const row of rows) {
    const ready = row.status === 'listo';
    const video = {
      id: row.id,
      width: row.width,
      height: row.height,
      duration: row.duration,
      ...(ready ? videoUrls(row.file_key) : { url: null, poster: null }),
    };
    if (admin) Object.assign(video, { status: row.status, error: row.error });
    byCat.get(row.cat_id).push(video);
  }
  return byCat;
}

function parseTags(value) {
  try {
    const tags = JSON.parse(value);
    return Array.isArray(tags) ? tags : [];
  } catch {
    return [];
  }
}

/** Forma pública de un gatito. Con admin=true añade los datos internos. */
export function serializeCat(row, photos = [], { admin = false, videos = [] } = {}) {
  const cat = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sex: row.sex,
    birthDate: row.birth_date,
    coat: row.coat,
    summary: row.summary,
    story: row.story,
    personality: parseTags(row.personality),
    goodWith: { kids: row.good_with_kids, cats: row.good_with_cats, dogs: row.good_with_dogs },
    health: {
      vaccinated: Boolean(row.vaccinated),
      dewormed: Boolean(row.dewormed),
      microchipped: Boolean(row.microchipped),
      sterilized: Boolean(row.sterilized),
      fivFelv: row.fiv_felv,
    },
    specialNeeds: row.special_needs,
    location: row.location,
    status: row.status,
    featured: Boolean(row.featured),
    arrivedAt: row.arrived_at,
    adoptedAt: row.adopted_at,
    happyEnding: row.happy_ending,
    photos,
    videos,
  };
  if (admin) {
    cat.likes = row.likes;
    cat.createdAt = row.created_at;
    cat.updatedAt = row.updated_at;
    cat.record = serializeRecord(row);
  }
  return cat;
}

/** Ficha interna: lo que va a los papeles y nunca sale en la web. */
export function serializeRecord(row) {
  return {
    fileNumber: row.file_number ?? '',
    breed: row.breed,
    microchipNumber: row.microchip_number,
    intakePlace: row.intake_place,
    intakeBy: row.intake_by,
    intakePhone: row.intake_phone,
    intakeReason: row.intake_reason,
    colonyMember: row.colony_member,
    colonyName: row.colony_name,
    colonyCaretaker: row.colony_caretaker,
    earTipped: row.ear_tipped,
    inTreatment: Boolean(row.in_treatment),
    fosterId: row.foster_id,
    fosterSince: row.foster_since ?? '',
    returnedAt: row.returned_at ?? '',
    pending: row.pending,
  };
}

export function serializeCats(rows, { admin = false } = {}) {
  const ids = rows.map((row) => row.id);
  const photos = photosFor(ids);
  const videos = videosFor(ids, { admin });
  return rows.map((row) => serializeCat(row, photos.get(row.id), { admin, videos: videos.get(row.id) }));
}

export function slugify(name) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'gatito';
}

/** Slug único: «luna», «luna-2», «luna-3»… Se fija al crear y no cambia al renombrar, para no romper enlaces compartidos. */
export function uniqueSlug(name) {
  const base = slugify(name);
  const exists = db.prepare('SELECT 1 FROM cats WHERE slug = ?');
  if (!exists.get(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!exists.get(candidate)) return candidate;
  }
}

export function publicStats(rescuedBase = 0) {
  const year = new Date().getFullYear();
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status IN (${PUBLIC_STATUSES_SQL}) THEN 1 ELSE 0 END) AS rescued,
         SUM(CASE WHEN status = 'disponible' THEN 1 ELSE 0 END) AS available,
         SUM(CASE WHEN status = 'adoptado' AND adopted_at >= ? THEN 1 ELSE 0 END) AS adopted_this_year
       FROM cats`,
    )
    .get(`${year}-01-01`);
  return {
    rescued: (row.rescued ?? 0) + rescuedBase,
    available: row.available ?? 0,
    adoptedThisYear: row.adopted_this_year ?? 0,
    year,
  };
}
