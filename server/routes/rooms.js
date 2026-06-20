import express from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db.js';
import { TOPIC_COLORS } from '../llm.js';

const DEFAULT_TOPICS = [
  'Träume & Ziele',
  'Kindheit & Erinnerungen',
  'Liebe & Beziehung',
  'Sex & Intimität',
  'Reisen & Abenteuer',
  'Alltag & Gewohnheiten',
  'Werte & Überzeugungen',
  'Freunde & Soziales',
  'Arbeit & Karriere',
  'Fantasie & Was wäre wenn',
];

const router = express.Router();

router.post('/', (req, res) => {
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid admin secret' });
  }

  const { name, person_a_name, person_b_name } = req.body;
  if (!name || !person_a_name || !person_b_name) {
    return res.status(400).json({ error: 'name, person_a_name, person_b_name required' });
  }

  const db = getDb();
  const roomId = randomUUID();
  const adminToken = randomUUID();
  const tokenA = randomUUID();
  const tokenB = randomUUID();

  db.prepare('INSERT INTO rooms (id, name, admin_token) VALUES (?, ?, ?)').run(roomId, name, adminToken);
  db.prepare('INSERT INTO persons (id, room_id, token, display_name) VALUES (?, ?, ?, ?)').run(randomUUID(), roomId, tokenA, person_a_name);
  db.prepare('INSERT INTO persons (id, room_id, token, display_name) VALUES (?, ?, ?, ?)').run(randomUUID(), roomId, tokenB, person_b_name);

  const insertTopic = db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 1)');
  DEFAULT_TOPICS.forEach((name, i) => {
    insertTopic.run(randomUUID(), roomId, name, TOPIC_COLORS[i % TOPIC_COLORS.length]);
  });

  const baseUrl = `${req.protocol}://${req.get('host')}`;

  res.status(201).json({
    room_id: roomId,
    admin_url: `${baseUrl}/admin/${adminToken}`,
    person_a: { name: person_a_name, url: `${baseUrl}/join/${tokenA}` },
    person_b: { name: person_b_name, url: `${baseUrl}/join/${tokenB}` },
  });
});

export default router;
