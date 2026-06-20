import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { classifyAndAssign } from './llm.js';

function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE rooms (id TEXT PRIMARY KEY, name TEXT, admin_token TEXT, auto_categorize INTEGER DEFAULT 0);
    CREATE TABLE persons (id TEXT PRIMARY KEY, room_id TEXT, token TEXT, display_name TEXT);
    CREATE TABLE topics (id TEXT PRIMARY KEY, room_id TEXT, name TEXT, color TEXT, enabled INTEGER DEFAULT 1);
    CREATE TABLE questions (id TEXT PRIMARY KEY, room_id TEXT, person_id TEXT, text TEXT, status TEXT DEFAULT 'active', topic_id TEXT);
  `);
  return db;
}

function mockClient(returnedTopicName) {
  return {
    messages: {
      create: async () => ({ content: [{ text: returnedTopicName }] }),
    },
  };
}

function failingClient() {
  return {
    messages: {
      create: async () => { throw new Error('API Error'); },
    },
  };
}

describe('classifyAndAssign', () => {
  let db, roomId, personId, questionId;

  beforeEach(() => {
    db = createTestDb();
    roomId = randomUUID();
    personId = randomUUID();
    questionId = randomUUID();
    db.prepare('INSERT INTO rooms (id, name, admin_token) VALUES (?, ?, ?)').run(roomId, 'Test', randomUUID());
    db.prepare('INSERT INTO persons (id, room_id, token, display_name) VALUES (?, ?, ?, ?)').run(personId, roomId, randomUUID(), 'Alice');
    db.prepare('INSERT INTO questions (id, room_id, person_id, text) VALUES (?, ?, ?, ?)').run(questionId, roomId, personId, 'Testfrage');
  });

  it('tut nichts wenn keine aktivierten Topics vorhanden sind', async () => {
    const client = mockClient('Kindheit');
    await classifyAndAssign(db, roomId, questionId, 'Testfrage', client);

    // No API call — no enabled topics
    const q = db.prepare('SELECT topic_id FROM questions WHERE id = ?').get(questionId);
    assert.equal(q.topic_id, null);
  });

  it('ignoriert deaktivierte Topics (enabled = 0)', async () => {
    db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 0)')
      .run(randomUUID(), roomId, 'Kindheit', '#f87171');

    await classifyAndAssign(db, roomId, questionId, 'Testfrage', mockClient('Kindheit'));

    const q = db.prepare('SELECT topic_id FROM questions WHERE id = ?').get(questionId);
    assert.equal(q.topic_id, null);
  });

  it('weist passendes Topic zu wenn LLM bekannten Namen zurückgibt', async () => {
    const topicId = randomUUID();
    db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 1)')
      .run(topicId, roomId, 'Kindheit', '#f87171');

    await classifyAndAssign(db, roomId, questionId, 'Liebste Kindheitserinnerung?', mockClient('Kindheit'));

    const q = db.prepare('SELECT topic_id FROM questions WHERE id = ?').get(questionId);
    assert.equal(q.topic_id, topicId);
  });

  it('vergibt keine Zuweisung wenn LLM unbekannten Namen zurückgibt', async () => {
    const topicId = randomUUID();
    db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 1)')
      .run(topicId, roomId, 'Kindheit', '#f87171');

    await classifyAndAssign(db, roomId, questionId, 'Testfrage', mockClient('NeuesErfundenesThema'));

    const q = db.prepare('SELECT topic_id FROM questions WHERE id = ?').get(questionId);
    assert.equal(q.topic_id, null);

    const topics = db.prepare('SELECT id FROM topics WHERE room_id = ?').all(roomId);
    assert.equal(topics.length, 1); // kein neues Topic erstellt
  });

  it('matching ist case-insensitiv', async () => {
    const topicId = randomUUID();
    db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 1)')
      .run(topicId, roomId, 'Kindheit', '#f87171');

    await classifyAndAssign(db, roomId, questionId, 'Testfrage', mockClient('kindheit'));

    const q = db.prepare('SELECT topic_id FROM questions WHERE id = ?').get(questionId);
    assert.equal(q.topic_id, topicId);
  });

  it('schlägt lautlos fehl wenn die API einen Fehler wirft', async () => {
    db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 1)')
      .run(randomUUID(), roomId, 'Kindheit', '#f87171');

    await assert.doesNotReject(() =>
      classifyAndAssign(db, roomId, questionId, 'Testfrage', failingClient())
    );

    const q = db.prepare('SELECT topic_id FROM questions WHERE id = ?').get(questionId);
    assert.equal(q.topic_id, null);
  });

  it('übergibt nur aktivierte Topics an den Prompt', async () => {
    let capturedPrompt = '';
    const capturingClient = {
      messages: {
        create: async ({ messages }) => {
          capturedPrompt = messages[0].content;
          return { content: [{ text: 'Reisen' }] };
        },
      },
    };

    db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 1)')
      .run(randomUUID(), roomId, 'Reisen', '#60a5fa');
    db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 0)')
      .run(randomUUID(), roomId, 'GeheimesThema', '#f87171');

    await classifyAndAssign(db, roomId, questionId, 'Testfrage', capturingClient);

    assert.ok(capturedPrompt.includes('Reisen'));
    assert.ok(!capturedPrompt.includes('GeheimesThema'));
  });
});
