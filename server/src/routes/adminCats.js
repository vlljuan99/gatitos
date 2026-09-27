import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { VIDEO_TMP_DIR } from '../config.js';
import { CAT_STATUSES, serializeCats, uniqueSlug } from '../cats.js';
import { deletePhotoFiles, ImageError, savePhoto } from '../images.js';
import { deleteVideoFiles, enqueueVideo, MAX_VIDEO_MB, MAX_VIDEOS, videoSupport } from '../videos.js';
import { parseBody, parseId, requiredText, text } from '../validation.js';

const MAX_PHOTOS = 12;
const triState = z.enum(['si', 'no', 'desconocido']).default('desconocido');
// Las fechas vacías llegan como '' desde el formulario o como null al reenviar
// un gatito tal cual se leyó: ambas significan «sin fecha».
const optionalDate = (schema) =>
  z
    .union([z.literal(''), schema])
    .nullish()
    .transform((value) => value ?? '');
const month = optionalDate(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Fecha no válida'));
const day = optionalDate(z.iso.date('Fecha no válida'));

const catSchema = z
  .object({
    name: requiredText(60, 'Ponle un nombre'),
    sex: z.enum(['macho', 'hembra', 'desconocido']).default('desconocido'),
    birthDate: month,
    coat: text(80).default(''),
    summary: text(220).default(''),
    story: text(5000).default(''),
    personality: z.array(text(30).min(1)).max(8, 'Como mucho 8 etiquetas').default([]),
    goodWith: z.object({ kids: triState, cats: triState, dogs: triState }).prefault({}),
    health: z
      .object({
        vaccinated: z.boolean().default(false),
        dewormed: z.boolean().default(false),
        microchipped: z.boolean().default(false),
        sterilized: z.boolean().default(false),
        fivFelv: z.enum(['negativo', 'positivo_fiv', 'positivo_felv', 'pendiente']).default('pendiente'),
      })
      .prefault({}),
    specialNeeds: text(1500).default(''),
    location: text(120).default(''),
    status: z.enum(CAT_STATUSES).default('borrador'),
    featured: z.boolean().default(false),
    arrivedAt: day,
    adoptedAt: day,
    happyEnding: text(3000).default(''),
  })
  .superRefine((data, ctx) => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    if (data.birthDate && data.birthDate > thisMonth) {
      ctx.addIssue({ code: 'custom', path: ['birthDate'], message: 'La fecha de nacimiento no puede ser futura' });
    }
  });

function catParams(data) {
  const adoptedAt =
    data.status === 'adoptado' ? data.adoptedAt || new Date().toISOString().slice(0, 10) : null;
  return {
    name: data.name,
    sex: data.sex,
    birth_date: data.birthDate || null,
    coat: data.coat,
    summary: data.summary,
    story: data.story,
    personality: JSON.stringify([...new Set(data.personality)]),
    good_with_kids: data.goodWith.kids,
    good_with_cats: data.goodWith.cats,
    good_with_dogs: data.goodWith.dogs,
    vaccinated: data.health.vaccinated ? 1 : 0,
    dewormed: data.health.dewormed ? 1 : 0,
    microchipped: data.health.microchipped ? 1 : 0,
    sterilized: data.health.sterilized ? 1 : 0,
    fiv_felv: data.health.fivFelv,
    special_needs: data.specialNeeds,
    location: data.location,
    status: data.status,
    featured: data.featured ? 1 : 0,
    arrived_at: data.arrivedAt || null,
    adopted_at: adoptedAt,
    happy_ending: data.happyEnding,
  };
}

function loadCat(id) {
  const row = db.prepare('SELECT * FROM cats WHERE id = ?').get(id);
  return row ? serializeCats([row], { admin: true })[0] : null;
}

export function adminCatsRouter() {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: MAX_PHOTOS },
  });
  // Los vídeos van directos a disco (pueden pesar cientos de MB) con un nombre
  // aleatorio que será su clave: «<uuid>.original».
  const videoUpload = multer({
    storage: multer.diskStorage({
      destination: VIDEO_TMP_DIR,
      filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.original`),
    }),
    limits: { fileSize: MAX_VIDEO_MB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('video/')),
  });

  router.get('/', (req, res) => {
    const rows = db
      .prepare(
        `SELECT * FROM cats ORDER BY
           CASE status WHEN 'borrador' THEN 0 WHEN 'disponible' THEN 1 WHEN 'reservado' THEN 2 ELSE 3 END,
           updated_at DESC`,
      )
      .all();
    res.json({ cats: serializeCats(rows, { admin: true }) });
  });

  router.get('/:id', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const cat = loadCat(id);
    if (!cat) return res.status(404).json({ error: 'No encontramos a este gatito' });
    res.json({ cat });
  });

  router.post('/', (req, res) => {
    const data = parseBody(catSchema, req, res);
    if (!data) return;
    const params = { ...catParams(data), slug: uniqueSlug(data.name), created_by: req.user.id };
    const columns = Object.keys(params);
    const info = db
      .prepare(`INSERT INTO cats (${columns.join(', ')}) VALUES (${columns.map((c) => `@${c}`).join(', ')})`)
      .run(params);
    res.status(201).json({ cat: loadCat(info.lastInsertRowid) });
  });

  router.put('/:id', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(catSchema, req, res);
    if (!data) return;
    const params = catParams(data);
    const current = db.prepare('SELECT adopted_at FROM cats WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'No encontramos a este gatito' });
    // Si ya estaba adoptado y no se indica fecha, se conserva la original.
    if (data.status === 'adoptado' && !data.adoptedAt && current.adopted_at) params.adopted_at = current.adopted_at;
    const sets = Object.keys(params).map((c) => `${c} = @${c}`);
    db.prepare(`UPDATE cats SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = @id`).run({ ...params, id });
    res.json({ cat: loadCat(id) });
  });

  // Cambio rápido de estado desde el listado (un toque).
  router.patch('/:id/estado', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(z.object({ status: z.enum(CAT_STATUSES) }), req, res);
    if (!data) return;
    const info = setCatStatus(id, data.status);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos a este gatito' });
    res.json({ cat: loadCat(id) });
  });

  router.delete('/:id', requireAdmin, async (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const photos = db.prepare('SELECT file_key FROM cat_photos WHERE cat_id = ?').all(id);
    const videos = db.prepare('SELECT file_key FROM cat_videos WHERE cat_id = ?').all(id);
    const info = db.prepare('DELETE FROM cats WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos a este gatito' });
    await Promise.all([...photos.map((p) => deletePhotoFiles(p.file_key)), ...videos.map((v) => deleteVideoFiles(v.file_key))]);
    res.json({ ok: true });
  });

  router.post('/:id/fotos', upload.array('fotos', MAX_PHOTOS), async (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    if (!db.prepare('SELECT 1 FROM cats WHERE id = ?').get(id)) {
      return res.status(404).json({ error: 'No encontramos a este gatito' });
    }
    const files = req.files ?? [];
    if (files.length === 0) return res.status(400).json({ error: 'No ha llegado ninguna foto' });
    const { count, maxPosition } = db
      .prepare('SELECT COUNT(*) AS count, COALESCE(MAX(position), -1) AS maxPosition FROM cat_photos WHERE cat_id = ?')
      .get(id);
    if (count + files.length > MAX_PHOTOS) {
      return res.status(400).json({ error: `Cada gatito puede tener como mucho ${MAX_PHOTOS} fotos` });
    }

    const insert = db.prepare(
      'INSERT INTO cat_photos (cat_id, file_key, width, height, position) VALUES (?, ?, ?, ?, ?)',
    );
    const failed = [];
    let position = maxPosition;
    for (const file of files) {
      try {
        const photo = await savePhoto(file.buffer);
        position += 1;
        insert.run(id, photo.key, photo.width, photo.height, position);
      } catch (error) {
        if (!(error instanceof ImageError)) throw error;
        failed.push(file.originalname);
      }
    }
    db.prepare("UPDATE cats SET updated_at = datetime('now') WHERE id = ?").run(id);
    if (failed.length === files.length) {
      return res.status(400).json({ error: 'No he podido leer las fotos. Prueba con fotos en formato JPG o PNG.' });
    }
    res.status(201).json({ cat: loadCat(id), failed });
  });

  // El orden decide la portada: la primera foto es la que sale en tarjetas y en el match.
  router.put('/:id/fotos/orden', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(z.object({ ids: z.array(z.number().int()) }), req, res);
    if (!data) return;
    const current = db.prepare('SELECT id FROM cat_photos WHERE cat_id = ?').all(id).map((r) => r.id);
    const same =
      current.length === data.ids.length && new Set(data.ids).size === data.ids.length && data.ids.every((p) => current.includes(p));
    if (!same) return res.status(400).json({ error: 'La lista de fotos no coincide' });
    const update = db.prepare('UPDATE cat_photos SET position = ? WHERE id = ?');
    db.transaction(() => data.ids.forEach((photoId, index) => update.run(index, photoId)))();
    res.json({ cat: loadCat(id) });
  });

  router.delete('/:id/fotos/:photoId', async (req, res) => {
    const id = parseId(req.params.id, res);
    const photoId = id === null ? null : parseId(req.params.photoId, res);
    if (photoId === null) return;
    const photo = db.prepare('SELECT * FROM cat_photos WHERE id = ? AND cat_id = ?').get(photoId, id);
    if (!photo) return res.status(404).json({ error: 'No encontramos esta foto' });
    db.prepare('DELETE FROM cat_photos WHERE id = ?').run(photoId);
    await deletePhotoFiles(photo.file_key);
    res.json({ cat: loadCat(id) });
  });

  // Antes de recibir cientos de MB, comprobar que el vídeo cabe.
  function canAddVideo(req, res, next) {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    if (!videoSupport()) {
      return res.status(503).json({ error: 'Este servidor todavía no puede preparar vídeos' });
    }
    if (!db.prepare('SELECT 1 FROM cats WHERE id = ?').get(id)) {
      return res.status(404).json({ error: 'No encontramos a este gatito' });
    }
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM cat_videos WHERE cat_id = ?').get(id);
    if (count >= MAX_VIDEOS) {
      return res.status(400).json({ error: `Cada gatito puede tener como mucho ${MAX_VIDEOS} vídeos` });
    }
    req.catId = id;
    next();
  }

  // El vídeo se guarda tal cual llega y se prepara en segundo plano: la
  // respuesta llega enseguida con el vídeo en «procesando».
  router.post('/:id/videos', canAddVideo, videoUpload.single('video'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Eso no parece un vídeo. Elige uno de la galería.' });
    const id = req.catId;
    const fileKey = req.file.filename.replace(/\.original$/, '');
    const { count, maxPosition } = db
      .prepare('SELECT COUNT(*) AS count, COALESCE(MAX(position), -1) AS maxPosition FROM cat_videos WHERE cat_id = ?')
      .get(id);
    if (count >= MAX_VIDEOS || !db.prepare('SELECT 1 FROM cats WHERE id = ?').get(id)) {
      await fs.rm(req.file.path, { force: true });
      return res.status(400).json({ error: `Cada gatito puede tener como mucho ${MAX_VIDEOS} vídeos` });
    }
    const info = db
      .prepare('INSERT INTO cat_videos (cat_id, file_key, position) VALUES (?, ?, ?)')
      .run(id, fileKey, maxPosition + 1);
    enqueueVideo(info.lastInsertRowid);
    res.status(202).json({ cat: loadCat(id) });
  });

  router.delete('/:id/videos/:videoId', async (req, res) => {
    const id = parseId(req.params.id, res);
    const videoId = id === null ? null : parseId(req.params.videoId, res);
    if (videoId === null) return;
    const video = db.prepare('SELECT * FROM cat_videos WHERE id = ? AND cat_id = ?').get(videoId, id);
    if (!video) return res.status(404).json({ error: 'No encontramos este vídeo' });
    db.prepare('DELETE FROM cat_videos WHERE id = ?').run(videoId);
    await deleteVideoFiles(video.file_key);
    db.prepare("UPDATE cats SET updated_at = datetime('now') WHERE id = ?").run(id);
    res.json({ cat: loadCat(id) });
  });

  // Errores de multer (foto o vídeo demasiado grande, demasiadas fotos…) en castellano.
  router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
      let message = `Puedes subir como mucho ${MAX_PHOTOS} fotos a la vez`;
      if (error.code === 'LIMIT_FILE_SIZE') {
        message =
          error.field === 'video'
            ? `El vídeo pesa demasiado (máximo ${MAX_VIDEO_MB} MB). Recórtalo en el móvil y vuelve a probar.`
            : 'Alguna foto pesa demasiado (máximo 20 MB)';
      } else if (error.field === 'video') {
        message = 'Sube los vídeos de uno en uno';
      }
      return res.status(400).json({ error: message });
    }
    next(error);
  });

  return router;
}

export function setCatStatus(id, status) {
  return db
    .prepare(
      `UPDATE cats SET status = @status,
         adopted_at = CASE WHEN @status = 'adoptado' THEN COALESCE(adopted_at, date('now')) ELSE NULL END,
         updated_at = datetime('now')
       WHERE id = @id`,
    )
    .run({ id, status });
}
