import { api } from '../lib/api.js';

/**
 * Reduce la foto en el propio móvil antes de subirla (una foto de móvil pesa
 * 3-8 MB; así sube en segundos con datos). También la gira según la cámara.
 * Si el navegador no sabe leerla, se envía tal cual y el servidor lo intenta.
 */
export async function shrinkImage(file, max = 2400, quality = 0.88) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === 'image/jpeg' && file.size < 2_500_000) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Sube las fotos de una en una para poder enseñar el progreso. */
export async function uploadPhotos(catId, files, onProgress) {
  let cat = null;
  const failed = [];
  let lastError = '';
  for (let i = 0; i < files.length; i += 1) {
    onProgress?.(i, files.length);
    const form = new FormData();
    form.append('fotos', await shrinkImage(files[i]));
    try {
      const result = await api(`/admin/gatitos/${catId}/fotos`, { method: 'POST', body: form });
      cat = result.cat;
      if (result.failed?.length) failed.push(files[i].name);
    } catch (error) {
      failed.push(files[i].name);
      lastError = error.message;
    }
  }
  onProgress?.(files.length, files.length);
  return { cat, failed, lastError };
}
