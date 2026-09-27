import { PORT, PUBLIC_URL } from './config.js';
import { runMigrations } from './db.js';
import { createApp } from './app.js';
import { bootstrapAdmin, purgeOldData } from './maintenance.js';
import { resumeVideoJobs, videoSupport } from './videos.js';

runMigrations();
bootstrapAdmin();

function purge() {
  const removed = purgeOldData();
  const total = removed.applications + removed.messages + removed.volunteers;
  if (total > 0) console.log('[privacidad] Datos antiguos borrados:', removed);
}
purge();
setInterval(purge, 24 * 60 * 60 * 1000).unref();

if (!videoSupport()) console.warn('[vídeos] No encuentro ffmpeg: el panel no dejará subir vídeos.');
const resumed = await resumeVideoJobs();
if (resumed > 0) console.log(`[vídeos] Retomando ${resumed} vídeo(s) a medio preparar`);

const server = createApp().listen(PORT, () => {
  console.log(`🐾 Bigotes escuchando en http://localhost:${PORT} (pública: ${PUBLIC_URL})`);
});
// Un vídeo de 300 MB con datos móviles puede tardar más que los 5 minutos
// que Node da por defecto para recibir una petición entera.
server.requestTimeout = 30 * 60 * 1000;
