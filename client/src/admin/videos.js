import { ApiError } from '../lib/api.js';

// Mismos límites que el servidor (server/src/videos.js).
export const MAX_VIDEOS = 6;
export const MAX_VIDEO_MB = 300;
export const MAX_VIDEO_SECONDS = 60;

/** Duración del vídeo en segundos, leída en el propio móvil (null si no se sabe). */
export function videoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (value) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(value) ? value : null);
    };
    const timer = setTimeout(() => done(null), 5000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done(null);
    video.src = url;
  });
}

/** Comprueba el vídeo antes de subirlo. Devuelve un error o un aviso (o nada). */
export async function checkVideo(file) {
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    return {
      error: `Este vídeo pesa ${Math.round(file.size / 1024 / 1024)} MB y el máximo son ${MAX_VIDEO_MB} MB. Recórtalo en el móvil y vuelve a probar.`,
    };
  }
  const duration = await videoDuration(file);
  if (duration > MAX_VIDEO_SECONDS + 1) {
    return { warning: `Dura ${formatDuration(duration)}: se guardará el primer minuto.` };
  }
  return {};
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Sube un vídeo enseñando el porcentaje (fetch no lo permite, XMLHttpRequest
 * sí). El servidor responde enseguida y lo prepara en segundo plano.
 */
export function uploadVideo(catId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/admin/gatitos/${catId}/videos`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      const data = xhr.response ?? {};
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
      if (xhr.status === 401) window.dispatchEvent(new Event('bigotes:sesion-caducada'));
      reject(new ApiError(xhr.status, data.error ?? 'No se ha podido subir el vídeo. Vuelve a intentarlo.'));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Se ha cortado la conexión. Revisa tu internet y vuelve a probar.'));
    const form = new FormData();
    form.append('video', file);
    xhr.send(form);
  });
}
