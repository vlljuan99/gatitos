import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { CAT_PHOTOS_DIR } from './config.js';

export class ImageError extends Error {}

/**
 * Procesa una foto subida desde el móvil y guarda tres versiones:
 *  - «lg» (hasta 1600 px, WebP) para la ficha y el modo match
 *  - «sm» (hasta 640 px, WebP) para tarjetas y listados
 *  - «og» (1200×630, JPEG) para la vista previa al compartir en WhatsApp/redes
 *
 * sharp no copia los metadatos a la salida salvo que se pida, así que se
 * pierden el EXIF y en concreto la ubicación GPS: si no, se publicaría dónde
 * vive la casa de acogida. rotate() aplica antes la orientación del móvil.
 */
export async function savePhoto(buffer) {
  let image;
  try {
    image = sharp(buffer, { failOn: 'error' }).rotate();
    await image.metadata();
  } catch {
    throw new ImageError('No he podido leer esta foto. Prueba con otra en formato JPG o PNG.');
  }

  const key = crypto.randomUUID();
  const file = (suffix) => path.join(CAT_PHOTOS_DIR, `${key}-${suffix}`);
  try {
    const lg = await image
      .clone()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(file('lg.webp'));
    await image
      .clone()
      .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(file('sm.webp'));
    await image
      .clone()
      .resize({ width: 1200, height: 630, fit: 'cover', position: sharp.strategy.attention })
      .flatten({ background: '#fff7ef' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(file('og.jpg'));
    return { key, width: lg.width, height: lg.height };
  } catch (error) {
    await deletePhotoFiles(key);
    if (error instanceof ImageError) throw error;
    throw new ImageError('No he podido procesar esta foto. Prueba con otra.');
  }
}

export async function deletePhotoFiles(key) {
  await Promise.all(
    ['lg.webp', 'sm.webp', 'og.jpg'].map((suffix) =>
      fs.rm(path.join(CAT_PHOTOS_DIR, `${key}-${suffix}`), { force: true }),
    ),
  );
}
