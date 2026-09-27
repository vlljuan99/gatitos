import Database from 'better-sqlite3';
import { DB_PATH } from './config.js';

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migraciones incrementales controladas por PRAGMA user_version.
// Cada entrada se ejecuta una sola vez y en orden: añadir nuevas al final y
// no editar nunca una que ya se haya aplicado en producción.
export const migrations = [
  // v1 — modelo base: equipo, gatitos, fotos, solicitudes, mensajes,
  // voluntariado y contenidos editables
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cuidabigotes' CHECK (role IN ('admin', 'cuidabigotes')),
    active INTEGER NOT NULL DEFAULT 1,
    session_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );

  CREATE TABLE cats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sex TEXT NOT NULL DEFAULT 'desconocido' CHECK (sex IN ('macho', 'hembra', 'desconocido')),
    birth_date TEXT,
    coat TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    story TEXT NOT NULL DEFAULT '',
    personality TEXT NOT NULL DEFAULT '[]',
    good_with_kids TEXT NOT NULL DEFAULT 'desconocido' CHECK (good_with_kids IN ('si', 'no', 'desconocido')),
    good_with_cats TEXT NOT NULL DEFAULT 'desconocido' CHECK (good_with_cats IN ('si', 'no', 'desconocido')),
    good_with_dogs TEXT NOT NULL DEFAULT 'desconocido' CHECK (good_with_dogs IN ('si', 'no', 'desconocido')),
    vaccinated INTEGER NOT NULL DEFAULT 0,
    dewormed INTEGER NOT NULL DEFAULT 0,
    microchipped INTEGER NOT NULL DEFAULT 0,
    sterilized INTEGER NOT NULL DEFAULT 0,
    fiv_felv TEXT NOT NULL DEFAULT 'pendiente' CHECK (fiv_felv IN ('negativo', 'positivo_fiv', 'positivo_felv', 'pendiente')),
    special_needs TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'disponible', 'reservado', 'adoptado')),
    featured INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    arrived_at TEXT,
    adopted_at TEXT,
    happy_ending TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_cats_status ON cats(status);

  CREATE TABLE cat_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cat_id INTEGER NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
    file_key TEXT NOT NULL UNIQUE,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_cat_photos_cat ON cat_photos(cat_id, position);

  CREATE TABLE applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cat_id INTEGER REFERENCES cats(id) ON DELETE SET NULL,
    cat_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'nueva' CHECK (status IN ('nueva', 'entrevista', 'visita', 'aprobada', 'adoptado', 'descartada')),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    municipality TEXT NOT NULL,
    province TEXT NOT NULL,
    answers TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_applications_status ON applications(status, created_at);

  CREATE TABLE application_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_application_notes_app ON application_notes(application_id);

  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'leido', 'archivado')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE volunteers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    municipality TEXT NOT NULL,
    areas TEXT NOT NULL DEFAULT '[]',
    availability TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'contactado', 'archivado')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,

  // v2 — vídeos de los gatitos. Se preparan en segundo plano (ffmpeg), así
  // que cada vídeo pasa por «procesando» antes de estar «listo» para la web.
  `
  CREATE TABLE cat_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cat_id INTEGER NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
    file_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'procesando' CHECK (status IN ('procesando', 'listo', 'error')),
    width INTEGER,
    height INTEGER,
    duration REAL,
    error TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_cat_videos_cat ON cat_videos(cat_id, position);
  `,
];

export function runMigrations(database = db) {
  const current = database.pragma('user_version', { simple: true });
  for (let version = current; version < migrations.length; version += 1) {
    database.transaction(() => {
      database.exec(migrations[version]);
      database.pragma(`user_version = ${version + 1}`);
    })();
  }
  return database.pragma('user_version', { simple: true });
}
