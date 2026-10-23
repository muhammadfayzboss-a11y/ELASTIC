import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openDatabase(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','student')), created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
      csrf TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS group_admins (
      group_id INTEGER NOT NULL REFERENCES groups(id), user_id INTEGER NOT NULL REFERENCES users(id),
      PRIMARY KEY(group_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS memberships (
      group_id INTEGER NOT NULL REFERENCES groups(id), user_id INTEGER NOT NULL REFERENCES users(id),
      active INTEGER NOT NULL DEFAULT 1, joined_at TEXT NOT NULL,
      PRIMARY KEY(group_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES groups(id), catalog_key TEXT,
      category TEXT NOT NULL CHECK(category IN ('fruit','vegetable','grain','other')),
      name_uz TEXT NOT NULL, name_en TEXT NOT NULL, name_ru TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'kg', active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(group_id,catalog_key)
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES groups(id),
      user_id INTEGER NOT NULL REFERENCES users(id), product_id INTEGER NOT NULL REFERENCES products(id),
      started_at TEXT NOT NULL, ended_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_product_owner ON assignments(product_id) WHERE ended_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_product ON assignments(group_id,user_id) WHERE ended_at IS NULL;
    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES groups(id),
      token_hash TEXT NOT NULL UNIQUE, created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL, expires_at TEXT, max_uses INTEGER, uses INTEGER NOT NULL DEFAULT 0, revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS schedules (
      group_id INTEGER PRIMARY KEY REFERENCES groups(id),
      mode TEXT NOT NULL DEFAULT 'manual' CHECK(mode IN ('manual','single','weekly')),
      manual_open INTEGER NOT NULL DEFAULT 0, manual_start TEXT,
      start_at TEXT, end_at TEXT, weekday INTEGER NOT NULL DEFAULT 1,
      minute INTEGER NOT NULL DEFAULT 480, duration_minutes INTEGER NOT NULL DEFAULT 2160,
      revision INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS periods (
      id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES groups(id),
      period_key TEXT NOT NULL, start_at TEXT NOT NULL, end_at TEXT,
      UNIQUE(group_id,period_key)
    );
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES groups(id),
      assignment_id INTEGER NOT NULL REFERENCES assignments(id),
      period_id INTEGER NOT NULL REFERENCES periods(id), created_at TEXT NOT NULL,
      UNIQUE(assignment_id,period_id)
    );
    CREATE TABLE IF NOT EXISTS price_revisions (
      id INTEGER PRIMARY KEY, submission_id INTEGER NOT NULL REFERENCES submissions(id),
      version INTEGER NOT NULL, observed_on TEXT NOT NULL,
      korzinka INTEGER, secondary_store TEXT NOT NULL CHECK(secondary_store IN ('Havas','Mall')),
      secondary INTEGER, local_store TEXT NOT NULL, local INTEGER,
      created_at TEXT NOT NULL, UNIQUE(submission_id,version)
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES groups(id),
      actor_id INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL, details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS submissions_group ON submissions(group_id,created_at);
    CREATE INDEX IF NOT EXISTS assignments_user ON assignments(group_id,user_id);
    CREATE INDEX IF NOT EXISTS revisions_submission ON price_revisions(submission_id,version DESC);
  `);
  // Additive, transactional v2 migration: existing accounts and history are retained.
  transaction(db, () => {
    const columns = db.prepare("PRAGMA table_info(assignments)").all().map(column => column.name);
    if (!columns.includes("end_reason")) db.exec("ALTER TABLE assignments ADD COLUMN end_reason TEXT");
    if (!columns.includes("end_note")) db.exec("ALTER TABLE assignments ADD COLUMN end_note TEXT NOT NULL DEFAULT ''");
    db.exec("PRAGMA user_version = 2");
  });
  // Additive v3: approvals and store evidence never overwrite historical prices.
  transaction(db, () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS product_change_requests (
        id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES groups(id),
        user_id INTEGER NOT NULL REFERENCES users(id), assignment_id INTEGER NOT NULL REFERENCES assignments(id),
        product_id INTEGER NOT NULL REFERENCES products(id), reason TEXT NOT NULL, note TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
        requested_at TEXT NOT NULL, reviewed_at TEXT, reviewed_by INTEGER REFERENCES users(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS one_pending_change ON product_change_requests(group_id,user_id) WHERE status='pending';
      CREATE TABLE IF NOT EXISTS store_locations (
        id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES groups(id), user_id INTEGER NOT NULL REFERENCES users(id),
        store_key TEXT NOT NULL CHECK(store_key IN ('korzinka','secondary','local')), name TEXT NOT NULL, brand TEXT NOT NULL,
        latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','superseded')),
        requested_at TEXT NOT NULL, reviewed_at TEXT, reviewed_by INTEGER REFERENCES users(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS one_approved_location ON store_locations(group_id,user_id,store_key) WHERE status='approved';
      CREATE UNIQUE INDEX IF NOT EXISTS one_pending_location ON store_locations(group_id,user_id,store_key) WHERE status='pending';
      CREATE TABLE IF NOT EXISTS store_observations (
        id INTEGER PRIMARY KEY, revision_id INTEGER NOT NULL REFERENCES price_revisions(id),
        location_id INTEGER NOT NULL REFERENCES store_locations(id), store_key TEXT NOT NULL,
        latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL NOT NULL,
        measured_at TEXT NOT NULL, distance REAL NOT NULL, UNIQUE(revision_id,store_key)
      );
      PRAGMA user_version = 3;
    `);
  });
  return db;
}

export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try { const result = fn(); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
