import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db.js';
import { bootstrapAdmin, purgeOldData } from '../src/maintenance.js';

test('la primera administración se crea desde el entorno una sola vez', () => {
  const env = { ADMIN_EMAIL: 'Jefa@Bigotes.test', ADMIN_PASSWORD: 'una-contraseña-larga', ADMIN_NAME: 'Jefa' };
  const user = bootstrapAdmin(env);
  assert.equal(user.email, 'jefa@bigotes.test');
  assert.equal(user.role, 'admin');
  assert.equal(bootstrapAdmin({ ...env, ADMIN_EMAIL: 'otra@bigotes.test' }), null);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
});

test('borra solo los datos antiguos que ya no hacen falta', () => {
  const insertApp = db.prepare(
    `INSERT INTO applications (name, email, phone, municipality, province, status, updated_at)
     VALUES ('X', 'x@x.es', '600000000', 'Almendralejo', 'Badajoz', ?, datetime('now', ?))`,
  );
  insertApp.run('descartada', '-13 months');
  insertApp.run('descartada', '-2 months');
  insertApp.run('adoptado', '-30 months');
  const insertMsg = db.prepare(
    "INSERT INTO messages (name, email, body, status, updated_at) VALUES ('X', 'x@x.es', 'hola', ?, datetime('now', ?))",
  );
  insertMsg.run('archivado', '-13 months');
  insertMsg.run('leido', '-13 months');

  const removed = purgeOldData(12);
  assert.deepEqual(removed, { applications: 1, messages: 1, volunteers: 0, transport: 0 });
  const statuses = db.prepare('SELECT status FROM applications ORDER BY id').all().map((r) => r.status);
  assert.deepEqual(statuses, ['descartada', 'adoptado']);
});
