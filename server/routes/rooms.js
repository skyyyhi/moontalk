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

router.get('/', (req, res) => {
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid admin secret' });
  }

  const db = getDb();
  const rooms = db.prepare(`
    SELECT r.id, r.name, r.admin_token, r.created_at,
           p1.display_name as person_a_name, p1.token as person_a_token,
           p2.display_name as person_b_name, p2.token as person_b_token,
           COUNT(q.id) as question_count
    FROM rooms r
    JOIN persons p1 ON p1.room_id = r.id
    JOIN persons p2 ON p2.room_id = r.id AND p2.id != p1.id
    LEFT JOIN questions q ON q.room_id = r.id
    WHERE p1.id < p2.id
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `).all();

  res.json(rooms);
});

export default router;
