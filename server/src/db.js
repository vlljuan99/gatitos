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

  // v3 — papeles de la asociación: ficha interna de cada gato (n.º de ficha,
  // recogida, colonia, acogida), gatos de colonia (estado «colonia», nunca
  // salen en la web), casas de acogida, visitas al veterinario con su parte,
  // historial, datos del contrato de adopción, inventario y donaciones.
  // La tabla cats se rehace para admitir el estado nuevo (SQLite no deja
  // cambiar un CHECK), por eso esta migración corre sin claves foráneas.
  {
    foreignKeysOff: true,
    sql: `
  CREATE TABLE fosters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    dni TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE cats_v3 (
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
    status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'disponible', 'reservado', 'adoptado', 'colonia')),
    featured INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    arrived_at TEXT,
    adopted_at TEXT,
    happy_ending TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    file_number TEXT,
    breed TEXT NOT NULL DEFAULT '',
    microchip_number TEXT NOT NULL DEFAULT '',
    intake_place TEXT NOT NULL DEFAULT '',
    intake_by TEXT NOT NULL DEFAULT '',
    intake_phone TEXT NOT NULL DEFAULT '',
    intake_reason TEXT NOT NULL DEFAULT '',
    colony_member TEXT NOT NULL DEFAULT 'desconocido' CHECK (colony_member IN ('si', 'no', 'desconocido')),
    colony_name TEXT NOT NULL DEFAULT '',
    colony_caretaker TEXT NOT NULL DEFAULT '',
    ear_tipped TEXT NOT NULL DEFAULT 'desconocido' CHECK (ear_tipped IN ('si', 'no', 'desconocido')),
    in_treatment INTEGER NOT NULL DEFAULT 0,
    foster_id INTEGER REFERENCES fosters(id) ON DELETE SET NULL,
    foster_since TEXT,
    returned_at TEXT,
    pending TEXT NOT NULL DEFAULT ''
  );
  INSERT INTO cats_v3 (id, slug, name, sex, birth_date, coat, summary, story, personality,
    good_with_kids, good_with_cats, good_with_dogs, vaccinated, dewormed, microchipped, sterilized, fiv_felv,
    special_needs, location, status, featured, likes, arrived_at, adopted_at, happy_ending,
    created_by, created_at, updated_at)
  SELECT id, slug, name, sex, birth_date, coat, summary, story, personality,
    good_with_kids, good_with_cats, good_with_dogs, vaccinated, dewormed, microchipped, sterilized, fiv_felv,
    special_needs, location, status, featured, likes, arrived_at, adopted_at, happy_ending,
    created_by, created_at, updated_at
  FROM cats;
  -- Mismo contador que la tabla vieja: no se reutilizan ids de gatitos borrados.
  DELETE FROM sqlite_sequence WHERE name = 'cats_v3';
  INSERT INTO sqlite_sequence (name, seq) SELECT 'cats_v3', seq FROM sqlite_sequence WHERE name = 'cats';
  DROP TABLE cats;
  ALTER TABLE cats_v3 RENAME TO cats;
  CREATE INDEX idx_cats_status ON cats(status);
  CREATE UNIQUE INDEX idx_cats_file_number ON cats(file_number) WHERE file_number IS NOT NULL;
  CREATE INDEX idx_cats_foster ON cats(foster_id);

  -- N.º de ficha para los gatitos que ya había: año de llegada y orden de llegada.
  WITH numbered AS (
    SELECT id, strftime('%Y', COALESCE(arrived_at, created_at)) AS year,
      ROW_NUMBER() OVER (
        PARTITION BY strftime('%Y', COALESCE(arrived_at, created_at))
        ORDER BY COALESCE(arrived_at, created_at), id
      ) AS n
    FROM cats
  )
  UPDATE cats SET file_number = numbered.year || '-' || printf('%03d', numbered.n)
  FROM numbered WHERE numbered.id = cats.id;

  CREATE TABLE vet_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cat_id INTEGER NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
    number TEXT NOT NULL UNIQUE,
    date TEXT NOT NULL,
    carrier_name TEXT NOT NULL DEFAULT '',
    carrier_phone TEXT NOT NULL DEFAULT '',
    clinic TEXT NOT NULL DEFAULT '',
    diagnosis TEXT NOT NULL DEFAULT '',
    tests TEXT NOT NULL DEFAULT '',
    treatment TEXT NOT NULL DEFAULT '',
    medication TEXT NOT NULL DEFAULT '',
    next_check TEXT,
    amount_cents INTEGER,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_vet_visits_cat ON vet_visits(cat_id, date);

  CREATE TABLE cat_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cat_id INTEGER NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    body TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_cat_log_cat ON cat_log(cat_id, date);

  ALTER TABLE applications ADD COLUMN dni TEXT NOT NULL DEFAULT '';
  ALTER TABLE applications ADD COLUMN birth_date TEXT;
  ALTER TABLE applications ADD COLUMN address TEXT NOT NULL DEFAULT '';
  ALTER TABLE applications ADD COLUMN postal_code TEXT NOT NULL DEFAULT '';
  ALTER TABLE applications ADD COLUMN alt_contact_name TEXT NOT NULL DEFAULT '';
  ALTER TABLE applications ADD COLUMN alt_contact_phone TEXT NOT NULL DEFAULT '';
  ALTER TABLE applications ADD COLUMN alt_contact_relation TEXT NOT NULL DEFAULT '';
  ALTER TABLE applications ADD COLUMN contract_number TEXT;
  ALTER TABLE applications ADD COLUMN contract_date TEXT;
  CREATE UNIQUE INDEX idx_applications_contract ON applications(contract_number) WHERE contract_number IS NOT NULL;

  CREATE TABLE inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('medicacion', 'general')),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    min_quantity REAL,
    expires_on TEXT,
    instructions TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_inventory_kind ON inventory_items(kind, name);

  CREATE TABLE donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('dinero', 'material')),
    donor_name TEXT NOT NULL DEFAULT '',
    donor_contact TEXT NOT NULL DEFAULT '',
    amount_cents INTEGER,
    method TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_donations_date ON donations(date);
  `,
  },
];

/**
 * Aplica las migraciones pendientes. Cada una puede ser el SQL tal cual o
 * { sql, foreignKeysOff }: esta última forma es para rehacer una tabla
 * (crear la nueva, copiar, borrar la vieja y renombrar) sin que el borrado
 * arrastre en cascada fotos, vídeos o solicitudes. Al terminar se comprueba
 * que todas las referencias siguen siendo válidas.
 */
export function runMigrations(database = db) {
  const current = database.pragma('user_version', { simple: true });
  for (let version = current; version < migrations.length; version += 1) {
    const entry = migrations[version];
    const { sql, foreignKeysOff = false } = typeof entry === 'string' ? { sql: entry } : entry;
    if (foreignKeysOff) database.pragma('foreign_keys = OFF');
    try {
      database.transaction(() => {
        database.exec(sql);
        if (foreignKeysOff) {
          const broken = database.pragma('foreign_key_check');
          if (broken.length) throw new Error(`La migración ${version + 1} deja referencias rotas: ${JSON.stringify(broken)}`);
        }
        database.pragma(`user_version = ${version + 1}`);
      })();
    } finally {
      if (foreignKeysOff) database.pragma('foreign_keys = ON');
    }
  }
  return database.pragma('user_version', { simple: true });
}
