import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { mkdirSync } from 'fs';

const dbPath = process.env.DATABASE_PATH || './data/db.sqlite';

let db;

export function getDb() {
  if (!db) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    initSchema(db);
    migrate(db);
  }
  return db;
}

// Only for tests — resets the cached db instance
export function __resetDb() { db = null; }

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT,
      admin_token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      token TEXT UNIQUE NOT NULL,
      display_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      name TEXT NOT NULL,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS classify_log (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      question_id TEXT,
      question_text TEXT NOT NULL,
      topics_offered TEXT,
      llm_returned TEXT,
      matched_topic TEXT,
      status TEXT NOT NULL,
      error_msg TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      person_id TEXT NOT NULL REFERENCES persons(id),
      text TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      topic_id TEXT REFERENCES topics(id),
      source TEXT DEFAULT 'human',
      drawn_at DATETIME,
      draw_order INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function migrate(db) {
  try { db.exec('ALTER TABLE rooms ADD COLUMN auto_categorize INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE topics ADD COLUMN enabled INTEGER DEFAULT 1'); } catch {}
  // ALTER TABLE ADD COLUMN stores NULL for existing rows — explicitly set to 1
  db.exec("UPDATE topics SET enabled = 1 WHERE enabled IS NULL");
}
