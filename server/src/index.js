import { PORT, PUBLIC_URL } from './config.js';
import { runMigrations } from './db.js';
import { createApp } from './app.js';
import { bootstrapAdmin, purgeOldData } from './maintenance.js';

runMigrations();
bootstrapAdmin();

function purge() {
  const removed = purgeOldData();
  const total = removed.applications + removed.messages + removed.volunteers;
  if (total > 0) console.log('[privacidad] Datos antiguos borrados:', removed);
}
purge();
setInterval(purge, 24 * 60 * 60 * 1000).unref();

createApp().listen(PORT, () => {
  console.log(`🐾 Bigotes escuchando en http://localhost:${PORT} (pública: ${PUBLIC_URL})`);
});
