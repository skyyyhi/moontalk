import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import supertest from 'supertest';

// In-memory DB per test — no module mocking needed
const TOPIC_COLORS = ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#2dd4bf'];

function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE rooms (id TEXT PRIMARY KEY, name TEXT, admin_token TEXT UNIQUE NOT NULL, auto_categorize INTEGER DEFAULT 0);
    CREATE TABLE persons (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, token TEXT UNIQUE NOT NULL, display_name TEXT);
    CREATE TABLE topics (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT, enabled INTEGER DEFAULT 1);
    CREATE TABLE questions (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, person_id TEXT NOT NULL, text TEXT NOT NULL, status TEXT DEFAULT 'active', topic_id TEXT, source TEXT DEFAULT 'human', drawn_at DATETIME, draw_order INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);
  return db;
}

// Build a minimal Express app that uses the given DB directly (bypasses getDb())
function buildApp(db) {
  const app = express();
  app.use(express.json());

  // Inline requireAdmin middleware using the test DB
  function requireAdmin(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const room = db.prepare('SELECT * FROM rooms WHERE admin_token = ?').get(token);
    if (!room) return res.status(401).json({ error: 'Invalid admin token' });
    if (req.params.id && req.params.id !== room.id) return res.status(403).json({ error: 'Forbidden' });
    req.room = room;
    next();
  }

  // POST topic
  app.post('/api/rooms/:id/topics', requireAdmin, (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    const existing = db.prepare('SELECT id FROM topics WHERE room_id = ? AND name = ?').get(req.params.id, name.trim());
    if (existing) return res.status(409).json({ error: 'Kategorie existiert bereits' });
    const allTopics = db.prepare('SELECT id FROM topics WHERE room_id = ?').all(req.params.id);
    const color = TOPIC_COLORS[allTopics.length % TOPIC_COLORS.length];
    const id = randomUUID();
    db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 1)').run(id, req.params.id, name.trim(), color);
    res.status(201).json({ id, name: name.trim(), color, enabled: 1 });
  });

  // Toggle topic
  app.patch('/api/rooms/:id/topics/:tid/toggle', requireAdmin, (req, res) => {
    const topic = db.prepare('SELECT id, enabled FROM topics WHERE id = ? AND room_id = ?').get(req.params.tid, req.params.id);
    if (!topic) return res.status(404).json({ error: 'Not found' });
    const newEnabled = topic.enabled ? 0 : 1;
    db.prepare('UPDATE topics SET enabled = ? WHERE id = ?').run(newEnabled, topic.id);
    res.json({ id: topic.id, enabled: newEnabled });
  });

  // Delete topic
  app.delete('/api/rooms/:id/topics/:tid', requireAdmin, (req, res) => {
    const topic = db.prepare('SELECT id FROM topics WHERE id = ? AND room_id = ?').get(req.params.tid, req.params.id);
    if (!topic) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE questions SET topic_id = NULL WHERE topic_id = ?').run(topic.id);
    db.prepare('DELETE FROM topics WHERE id = ?').run(topic.id);
    res.status(204).end();
  });

  // Patch settings
  app.patch('/api/rooms/:id/settings', requireAdmin, (req, res) => {
    const { auto_categorize } = req.body;
    if (typeof auto_categorize !== 'boolean') return res.status(400).json({ error: 'auto_categorize (boolean) required' });
    db.prepare('UPDATE rooms SET auto_categorize = ? WHERE id = ?').run(auto_categorize ? 1 : 0, req.params.id);
    res.json({ auto_categorize });
  });

  return app;
}

describe('Admin Topic Routes', () => {
  let db, app, roomId, adminToken;

  beforeEach(() => {
    db = createTestDb();
    roomId = randomUUID();
    adminToken = randomUUID();
    db.prepare('INSERT INTO rooms (id, name, admin_token) VALUES (?, ?, ?)').run(roomId, 'Test Room', adminToken);
    app = buildApp(db);
  });

  describe('POST /topics', () => {
    it('erstellt ein Topic mit automatischer Farbe', async () => {
      const res = await supertest(app)
        .post(`/api/rooms/${roomId}/topics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Kindheit' });

      assert.equal(res.status, 201);
      assert.equal(res.body.name, 'Kindheit');
      assert.equal(res.body.enabled, 1);
      assert.ok(res.body.color);

      const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(res.body.id);
      assert.ok(topic);
    });

    it('gibt 409 bei doppeltem Namen zurück', async () => {
      db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 1)').run(randomUUID(), roomId, 'Kindheit', '#f87171');

      const res = await supertest(app)
        .post(`/api/rooms/${roomId}/topics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Kindheit' });

      assert.equal(res.status, 409);
    });

    it('gibt 400 zurück ohne Name', async () => {
      const res = await supertest(app)
        .post(`/api/rooms/${roomId}/topics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.equal(res.status, 400);
    });

    it('gibt 401 zurück ohne Token', async () => {
      const res = await supertest(app).post(`/api/rooms/${roomId}/topics`).send({ name: 'Test' });
      assert.equal(res.status, 401);
    });

    it('wechselt Farbe je nach Anzahl vorhandener Topics', async () => {
      db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 1)').run(randomUUID(), roomId, 'Erstes', '#f87171');

      const res = await supertest(app)
        .post(`/api/rooms/${roomId}/topics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Zweites' });

      assert.equal(res.body.color, TOPIC_COLORS[1]);
    });
  });

  describe('PATCH /topics/:tid/toggle', () => {
    it('deaktiviert ein aktives Topic', async () => {
      const topicId = randomUUID();
      db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 1)').run(topicId, roomId, 'Kindheit', '#f87171');

      const res = await supertest(app)
        .patch(`/api/rooms/${roomId}/topics/${topicId}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.enabled, 0);
      assert.equal(db.prepare('SELECT enabled FROM topics WHERE id = ?').get(topicId).enabled, 0);
    });

    it('aktiviert ein deaktiviertes Topic', async () => {
      const topicId = randomUUID();
      db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 0)').run(topicId, roomId, 'Kindheit', '#f87171');

      const res = await supertest(app)
        .patch(`/api/rooms/${roomId}/topics/${topicId}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.body.enabled, 1);
    });

    it('gibt 404 zurück für unbekanntes Topic', async () => {
      const res = await supertest(app)
        .patch(`/api/rooms/${roomId}/topics/${randomUUID()}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 404);
    });
  });

  describe('DELETE /topics/:tid', () => {
    it('löscht Topic und setzt topic_id in Fragen auf NULL', async () => {
      const topicId = randomUUID();
      db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 1)').run(topicId, roomId, 'Kindheit', '#f87171');
      const personId = randomUUID();
      db.prepare('INSERT INTO persons (id, room_id, token, display_name) VALUES (?, ?, ?, ?)').run(personId, roomId, randomUUID(), 'Alice');
      const questionId = randomUUID();
      db.prepare('INSERT INTO questions (id, room_id, person_id, text, topic_id) VALUES (?, ?, ?, ?, ?)').run(questionId, roomId, personId, 'Testfrage', topicId);

      const res = await supertest(app)
        .delete(`/api/rooms/${roomId}/topics/${topicId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 204);
      assert.equal(db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId), undefined);
      assert.equal(db.prepare('SELECT topic_id FROM questions WHERE id = ?').get(questionId).topic_id, null);
    });

    it('gibt 404 zurück für unbekanntes Topic', async () => {
      const res = await supertest(app)
        .delete(`/api/rooms/${roomId}/topics/${randomUUID()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 404);
    });
  });

  describe('PATCH /settings', () => {
    it('aktiviert auto_categorize', async () => {
      const res = await supertest(app)
        .patch(`/api/rooms/${roomId}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auto_categorize: true });

      assert.equal(res.status, 200);
      assert.equal(db.prepare('SELECT auto_categorize FROM rooms WHERE id = ?').get(roomId).auto_categorize, 1);
    });

    it('deaktiviert auto_categorize', async () => {
      db.prepare('UPDATE rooms SET auto_categorize = 1 WHERE id = ?').run(roomId);

      await supertest(app)
        .patch(`/api/rooms/${roomId}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auto_categorize: false });

      assert.equal(db.prepare('SELECT auto_categorize FROM rooms WHERE id = ?').get(roomId).auto_categorize, 0);
    });
  });
});
