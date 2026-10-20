import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { db } from './db.js';
import { CAT_VIDEOS_DIR, FFMPEG_PATH, FFPROBE_PATH, VIDEO_TMP_DIR } from './config.js';

// Vídeos de los gatitos. Un vídeo de móvil llega en HEVC, en 4K y con la
// ubicación GPS dentro; aquí se convierte a MP4 (H.264 + AAC, hasta 720p y
// 30 fps) que se ve en cualquier navegador, pesa poco con datos móviles y no
// lleva metadatos. Como tarda unos segundos, se prepara en segundo plano, de
// uno en uno para no quitarle CPU a la web ni a los vecinos del VPS.

export const MAX_VIDEOS = 6;
export const MAX_VIDEO_MB = 300;
export const MAX_VIDEO_SECONDS = 60;

// Solo se leen contenedores de vídeo normales: así un fichero disfrazado (por
// ejemplo, una lista de reproducción) no puede hacer que ffmpeg lea otras rutas.
const INPUT_FORMATS = 'mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi';
const TIMEOUT_MS = 10 * 60 * 1000;
// El lado largo queda en 1280 px como mucho, sin agrandar y con medidas pares.
const SCALE = "scale='if(gte(iw,ih),trunc(min(1280,iw)/2)*2,-2)':'if(gte(iw,ih),-2,trunc(min(1280,ih)/2)*2)'";
const READ_ERROR = 'No he podido leer este vídeo. Prueba con otro o grábalo de nuevo.';

let supported;
/** ¿Están ffmpeg y ffprobe instalados? (Se comprueba una vez). */
export function videoSupport() {
  if (supported === undefined) {
    const works = (bin) => spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;
    supported = works(FFMPEG_PATH) && works(FFPROBE_PATH);
  }
  return supported;
}

export function videoUrls(fileKey) {
  const base = `/uploads/videos/${fileKey}`;
  return { url: `${base}.mp4`, poster: `${base}-poster.webp` };
}

/** Ruta donde multer deja el original. Nunca se sirve: está fuera de /uploads. */
export const originalPath = (fileKey) => path.join(VIDEO_TMP_DIR, `${fileKey}.original`);
const finalPaths = (fileKey) => ({
  video: path.join(CAT_VIDEOS_DIR, `${fileKey}.mp4`),
  poster: path.join(CAT_VIDEOS_DIR, `${fileKey}-poster.webp`),
});
const workPaths = (fileKey) => ({
  video: path.join(VIDEO_TMP_DIR, `${fileKey}.mp4`),
  poster: path.join(VIDEO_TMP_DIR, `${fileKey}-poster.webp`),
});

export async function deleteVideoFiles(fileKey) {
  const files = [originalPath(fileKey), ...Object.values(finalPaths(fileKey)), ...Object.values(workPaths(fileKey))];
  await Promise.all(files.map((file) => fs.rm(file, { force: true })));
}

/** Ejecuta ffmpeg/ffprobe con prioridad baja y devuelve lo que escribe por stdout. */
function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      os.setPriority(child.pid, 10);
    } catch {
      // Sin permiso para bajar la prioridad: se sigue igual.
    }
    const out = [];
    let stderr = '';
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-2000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${path.basename(bin)} terminó con ${signal ?? code}: ${stderr.trim()}`));
    });
  });
}

async function transcode(input, output) {
  await run(FFMPEG_PATH, [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-format_whitelist', INPUT_FORMATS, '-protocol_whitelist', 'file',
    '-i', input,
    '-t', String(MAX_VIDEO_SECONDS),
    '-map', '0:v:0', '-map', '0:a:0?',
    // Fuera metadatos (ubicación GPS, modelo del móvil, fecha…) y capítulos.
    '-map_metadata', '-1', '-map_chapters', '-1', '-sn', '-dn',
    '-vf', SCALE, '-fpsmax', '30',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '96k', '-ac', '2',
    // faststart: empieza a reproducirse antes de descargarse entero.
    '-movflags', '+faststart', '-threads', '2',
    '-f', 'mp4', output,
  ]);
}

async function probe(file) {
  const out = await run(FFPROBE_PATH, [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json', file,
  ]);
  const info = JSON.parse(out.toString());
  return {
    width: info.streams?.[0]?.width ?? 0,
    height: info.streams?.[0]?.height ?? 0,
    duration: Number(info.format?.duration) || 0,
  };
}

/** Portada del vídeo: un fotograma del principio, en WebP. */
async function savePoster(video, duration, output) {
  const at = Math.min(1, duration / 3).toFixed(2);
  const png = await run(FFMPEG_PATH, [
    '-hide_banner', '-loglevel', 'error', '-nostdin',
    '-ss', at, '-i', video, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-',
  ]);
  await sharp(png).resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(output);
}

async function processVideo(id) {
  const row = db.prepare('SELECT * FROM cat_videos WHERE id = ?').get(id);
  if (!row || row.status !== 'procesando') return;
  const work = workPaths(row.file_key);
  const final = finalPaths(row.file_key);
  try {
    await transcode(originalPath(row.file_key), work.video);
    const info = await probe(work.video);
    if (!info.width || !info.height) throw new Error('El resultado no tiene imagen');
    await savePoster(work.video, info.duration, work.poster);
    // Solo pasa a la carpeta pública cuando está completo.
    await fs.rename(work.poster, final.poster);
    await fs.rename(work.video, final.video);
    const done = db
      .prepare("UPDATE cat_videos SET status = 'listo', width = ?, height = ?, duration = ? WHERE id = ? AND status = 'procesando'")
      .run(info.width, info.height, Math.round(info.duration * 10) / 10, id);
    if (done.changes === 0) {
      // Lo borraron (a él o a su gatito) mientras se preparaba.
      await deleteVideoFiles(row.file_key);
      return;
    }
    db.prepare("UPDATE cats SET updated_at = datetime('now') WHERE id = ?").run(row.cat_id);
  } catch (error) {
    console.error(`[vídeos] No se pudo preparar el vídeo ${id}:`, error.message);
    db.prepare("UPDATE cat_videos SET status = 'error', error = ? WHERE id = ?").run(READ_ERROR, id);
    await Promise.all(Object.values(work).map((file) => fs.rm(file, { force: true })));
  } finally {
    await fs.rm(originalPath(row.file_key), { force: true });
  }
}

let queue = Promise.resolve();

/** Pone un vídeo en la cola. Se preparan de uno en uno. */
export function enqueueVideo(id) {
  queue = queue.then(() => processVideo(id)).catch((error) => console.error('[vídeos]', error));
  return queue;
}

/** Se resuelve cuando la cola está vacía (para las pruebas). */
export async function videosIdle() {
  let current;
  do {
    current = queue;
    await current;
  } while (current !== queue);
}

/**
 * Al arrancar: retoma los vídeos que se quedaron a medias (por un reinicio o
 * un despliegue) y borra restos de subidas cortadas.
 */
export async function resumeVideoJobs() {
  const pending = db.prepare("SELECT id, file_key FROM cat_videos WHERE status = 'procesando'").all();
  const keep = new Set();
  for (const row of pending) {
    if (existsSync(originalPath(row.file_key))) {
      keep.add(path.basename(originalPath(row.file_key)));
      enqueueVideo(row.id);
    } else {
      db.prepare("UPDATE cat_videos SET status = 'error', error = ? WHERE id = ?").run(
        'Se cortó mientras se preparaba. Vuelve a subirlo.',
        row.id,
      );
    }
  }
  for (const name of await fs.readdir(VIDEO_TMP_DIR)) {
    if (!keep.has(name)) await fs.rm(path.join(VIDEO_TMP_DIR, name), { force: true });
  }
  return pending.length;
}
