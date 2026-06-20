import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import supertest from 'supertest';

const classifyCalls = [];

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

function buildApp(db) {
  const app = express();
  app.use(express.json());

  function requirePerson(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const person = db.prepare('SELECT * FROM persons WHERE token = ?').get(token);
    if (!person) return res.status(401).json({ error: 'Invalid token' });
    if (req.params.id && req.params.id !== person.room_id) return res.status(403).json({ error: 'Forbidden' });
    req.person = person;
    next();
  }

  app.get('/api/rooms/:id/questions', requirePerson, (req, res) => {
    const questions = db.prepare(`
      SELECT q.id, q.text, q.created_at, t.name as topic_name, t.color as topic_color
      FROM questions q
      LEFT JOIN topics t ON q.topic_id = t.id
      WHERE q.room_id = ? AND q.person_id = ? AND q.status = 'active'
      ORDER BY q.created_at DESC
    `).all(req.params.id, req.person.id);
    res.json(questions);
  });

  app.post('/api/rooms/:id/questions', requirePerson, (req, res) => {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text required' });
    const id = randomUUID();
    db.prepare('INSERT INTO questions (id, room_id, person_id, text) VALUES (?, ?, ?, ?)').run(id, req.params.id, req.person.id, text.trim());
    res.status(201).json({ id, text: text.trim() });
    const room = db.prepare('SELECT auto_categorize FROM rooms WHERE id = ?').get(req.params.id);
    if (room?.auto_categorize) {
      classifyCalls.push({ roomId: req.params.id, questionId: id, text: text.trim() });
    }
  });

  app.delete('/api/rooms/:id/questions/:qid', requirePerson, (req, res) => {
    const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.qid);
    if (!q) return res.status(404).json({ error: 'Not found' });
    if (q.person_id !== req.person.id) return res.status(403).json({ error: 'Forbidden' });
    if (q.room_id !== req.params.id) return res.status(403).json({ error: 'Forbidden' });
    if (q.status !== 'active') return res.status(400).json({ error: 'Cannot delete drawn question' });
    db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.qid);
    res.status(204).end();
  });

  return app;
}

describe('Questions Routes', () => {
  let db, app, roomId, personId, personToken;

  beforeEach(() => {
    classifyCalls.length = 0;
    db = createTestDb();
    roomId = randomUUID();
    personId = randomUUID();
    personToken = randomUUID();
    db.prepare('INSERT INTO rooms (id, name, admin_token, auto_categorize) VALUES (?, ?, ?, 0)').run(roomId, 'Test', randomUUID());
    db.prepare('INSERT INTO persons (id, room_id, token, display_name) VALUES (?, ?, ?, ?)').run(personId, roomId, personToken, 'Alice');
    app = buildApp(db);
  });

  describe('GET /questions', () => {
    it('gibt eigene aktive Fragen zurück', async () => {
      db.prepare('INSERT INTO questions (id, room_id, person_id, text) VALUES (?, ?, ?, ?)').run(randomUUID(), roomId, personId, 'Meine Frage');

      const res = await supertest(app).get(`/api/rooms/${roomId}/questions`).set('Authorization', `Bearer ${personToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].text, 'Meine Frage');
    });

    it('zeigt keine Fragen anderer Personen', async () => {
      const otherId = randomUUID();
      db.prepare('INSERT INTO persons (id, room_id, token, display_name) VALUES (?, ?, ?, ?)').run(otherId, roomId, randomUUID(), 'Bob');
      db.prepare('INSERT INTO questions (id, room_id, person_id, text) VALUES (?, ?, ?, ?)').run(randomUUID(), roomId, otherId, 'Bobs Frage');

      const res = await supertest(app).get(`/api/rooms/${roomId}/questions`).set('Authorization', `Bearer ${personToken}`);

      assert.equal(res.body.length, 0);
    });

    it('zeigt keine gezogenen Fragen', async () => {
      db.prepare("INSERT INTO questions (id, room_id, person_id, text, status) VALUES (?, ?, ?, ?, 'drawn')").run(randomUUID(), roomId, personId, 'Gezogen');

      const res = await supertest(app).get(`/api/rooms/${roomId}/questions`).set('Authorization', `Bearer ${personToken}`);

      assert.equal(res.body.length, 0);
    });

    it('schließt topic_name und topic_color ein', async () => {
      const topicId = randomUUID();
      db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 1)').run(topicId, roomId, 'Reisen', '#60a5fa');
      db.prepare('INSERT INTO questions (id, room_id, person_id, text, topic_id) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), roomId, personId, 'Lieblingsziel?', topicId);

      const res = await supertest(app).get(`/api/rooms/${roomId}/questions`).set('Authorization', `Bearer ${personToken}`);

      assert.equal(res.body[0].topic_name, 'Reisen');
      assert.equal(res.body[0].topic_color, '#60a5fa');
    });
  });

  describe('POST /questions', () => {
    it('erstellt eine Frage und gibt 201 zurück', async () => {
      const res = await supertest(app)
        .post(`/api/rooms/${roomId}/questions`)
        .set('Authorization', `Bearer ${personToken}`)
        .send({ text: 'Neue Frage?' });

      assert.equal(res.status, 201);
      assert.equal(res.body.text, 'Neue Frage?');
      assert.ok(res.body.id);

      const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(res.body.id);
      assert.ok(q);
      assert.equal(q.person_id, personId);
    });

    it('trimmt Whitespace im Text', async () => {
      const res = await supertest(app)
        .post(`/api/rooms/${roomId}/questions`)
        .set('Authorization', `Bearer ${personToken}`)
        .send({ text: '  Leerzeichen  ' });

      assert.equal(res.body.text, 'Leerzeichen');
    });

    it('startet classify NICHT wenn auto_categorize aus ist', async () => {
      await supertest(app)
        .post(`/api/rooms/${roomId}/questions`)
        .set('Authorization', `Bearer ${personToken}`)
        .send({ text: 'Testfrage' });

      assert.equal(classifyCalls.length, 0);
    });

    it('registriert classify-Aufruf wenn auto_categorize an ist', async () => {
      db.prepare('UPDATE rooms SET auto_categorize = 1 WHERE id = ?').run(roomId);

      const res = await supertest(app)
        .post(`/api/rooms/${roomId}/questions`)
        .set('Authorization', `Bearer ${personToken}`)
        .send({ text: 'Testfrage' });

      assert.equal(classifyCalls.length, 1);
      assert.equal(classifyCalls[0].questionId, res.body.id);
    });

    it('gibt 400 zurück ohne Text', async () => {
      const res = await supertest(app)
        .post(`/api/rooms/${roomId}/questions`)
        .set('Authorization', `Bearer ${personToken}`)
        .send({});

      assert.equal(res.status, 400);
    });
  });

  describe('DELETE /questions/:qid', () => {
    it('löscht eigene Frage', async () => {
      const qid = randomUUID();
      db.prepare('INSERT INTO questions (id, room_id, person_id, text) VALUES (?, ?, ?, ?)').run(qid, roomId, personId, 'Meine Frage');

      const res = await supertest(app)
        .delete(`/api/rooms/${roomId}/questions/${qid}`)
        .set('Authorization', `Bearer ${personToken}`);

      assert.equal(res.status, 204);
      assert.equal(db.prepare('SELECT * FROM questions WHERE id = ?').get(qid), undefined);
    });

    it('gibt 403 zurück beim Löschen fremder Fragen', async () => {
      const otherId = randomUUID();
      db.prepare('INSERT INTO persons (id, room_id, token, display_name) VALUES (?, ?, ?, ?)').run(otherId, roomId, randomUUID(), 'Bob');
      const qid = randomUUID();
      db.prepare('INSERT INTO questions (id, room_id, person_id, text) VALUES (?, ?, ?, ?)').run(qid, roomId, otherId, 'Bobs Frage');

      const res = await supertest(app)
        .delete(`/api/rooms/${roomId}/questions/${qid}`)
        .set('Authorization', `Bearer ${personToken}`);

      assert.equal(res.status, 403);
    });

    it('gibt 400 zurück beim Löschen einer gezogenen Frage', async () => {
      const qid = randomUUID();
      db.prepare("INSERT INTO questions (id, room_id, person_id, text, status) VALUES (?, ?, ?, ?, 'drawn')").run(qid, roomId, personId, 'Gezogen');

      const res = await supertest(app)
        .delete(`/api/rooms/${roomId}/questions/${qid}`)
        .set('Authorization', `Bearer ${personToken}`);

      assert.equal(res.status, 400);
    });
  });
});
