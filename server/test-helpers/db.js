import { DatabaseSync } from 'node:sqlite';

export function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE rooms (
      id TEXT PRIMARY KEY,
      name TEXT,
      admin_token TEXT UNIQUE NOT NULL,
      auto_categorize INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE persons (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      display_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      person_id TEXT NOT NULL,
      text TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      topic_id TEXT,
      source TEXT DEFAULT 'human',
      drawn_at DATETIME,
      draw_order INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}
