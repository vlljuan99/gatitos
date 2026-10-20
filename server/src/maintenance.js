import { db } from './db.js';
import { RETENTION_MONTHS } from './config.js';
import { createUser } from './auth.js';

/**
 * Borra datos personales que ya no hacen falta, como dice la política de
 * privacidad: solicitudes descartadas y mensajes, voluntariado y viajes
 * solidarios archivados con más de RETENTION_MONTHS meses sin cambios, y altas
 * de socios/as que nunca pagaron. Las adopciones y los recibos se conservan.
 */
export function purgeOldData(months = RETENTION_MONTHS) {
  const cutoff = `-${months} months`;
  return db.transaction(() => ({
    applications: db
      .prepare("DELETE FROM applications WHERE status = 'descartada' AND updated_at < datetime('now', ?)")
      .run(cutoff).changes,
    messages: db
      .prepare("DELETE FROM messages WHERE status = 'archivado' AND updated_at < datetime('now', ?)")
      .run(cutoff).changes,
    volunteers: db
      .prepare("DELETE FROM volunteers WHERE status = 'archivado' AND updated_at < datetime('now', ?)")
      .run(cutoff).changes,
    transport: db
      .prepare("DELETE FROM transport_volunteers WHERE status = 'archivado' AND updated_at < datetime('now', ?)")
      .run(cutoff).changes,
    // Quien se apuntó como socio/a en la web y nunca llegó a pagar. Con algún
    // recibo no se borra: los recibos se guardan para la contabilidad.
    members: db
      .prepare(
        `DELETE FROM members WHERE status = 'pendiente' AND updated_at < datetime('now', ?)
           AND NOT EXISTS (SELECT 1 FROM member_payments WHERE member_id = members.id)`,
      )
      .run(cutoff).changes,
  }))();
}

/**
 * Primer arranque: si no hay nadie en el equipo y llegan ADMIN_EMAIL y
 * ADMIN_PASSWORD por entorno, crea la cuenta de administración.
 */
export function bootstrapAdmin(env = process.env) {
  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (users > 0) return null;
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.log('[equipo] No hay usuarios. Crea la administración con "npm run create-user" o ADMIN_EMAIL/ADMIN_PASSWORD.');
    return null;
  }
  const user = createUser({
    email: env.ADMIN_EMAIL,
    name: env.ADMIN_NAME || 'Administración',
    role: 'admin',
    password: env.ADMIN_PASSWORD,
  });
  console.log(`[equipo] Cuenta de administración creada para ${user.email}`);
  return user;
}
