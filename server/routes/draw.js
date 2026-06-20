import express from 'express';
import { getDb } from '../db.js';
import { requirePerson } from '../middleware/auth.js';

const router = express.Router();

router.get('/:id/draw/topics', requirePerson, (req, res) => {
  const db = getDb();
  const topics = db.prepare(`
    SELECT t.id, t.name, t.color, COUNT(q.id) as count
    FROM topics t
    JOIN questions q ON q.topic_id = t.id AND q.status = 'active'
    WHERE t.room_id = ? AND q.room_id = ?
    GROUP BY t.id
    ORDER BY t.name
  `).all(req.params.id, req.params.id);
  res.json(topics);
});

router.get('/:id/draw/count', requirePerson, (req, res) => {
  const db = getDb();
  const { topic_id } = req.query;
  const result = topic_id
    ? db.prepare("SELECT COUNT(*) as count FROM questions WHERE room_id = ? AND status = 'active' AND topic_id = ?").get(req.params.id, topic_id)
    : db.prepare("SELECT COUNT(*) as count FROM questions WHERE room_id = ? AND status = 'active'").get(req.params.id);
  res.json({ count: result.count });
});

router.post('/:id/draw', requirePerson, (req, res) => {
  const db = getDb();
  const { topic_id } = req.body ?? {};

  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(draw_order), 0) as max_order FROM questions WHERE room_id = ?'
  ).get(req.params.id).max_order;

  const question = topic_id
    ? db.prepare(`
        SELECT q.id, q.text, t.name as topic_name, t.color as topic_color
        FROM questions q
        LEFT JOIN topics t ON q.topic_id = t.id
        WHERE q.room_id = ? AND q.status = 'active' AND q.topic_id = ?
        ORDER BY RANDOM() LIMIT 1
      `).get(req.params.id, topic_id)
    : db.prepare(`
        SELECT q.id, q.text, t.name as topic_name, t.color as topic_color
        FROM questions q
        LEFT JOIN topics t ON q.topic_id = t.id
        WHERE q.room_id = ? AND q.status = 'active'
        ORDER BY RANDOM() LIMIT 1
      `).get(req.params.id);

  if (!question) return res.status(404).json({ error: 'Keine Fragen mehr verfügbar' });

  db.prepare(
    "UPDATE questions SET status = 'drawn', drawn_at = CURRENT_TIMESTAMP, draw_order = ? WHERE id = ?"
  ).run(maxOrder + 1, question.id);

  res.json({ id: question.id, text: question.text, topic_name: question.topic_name, topic_color: question.topic_color });
});

router.post('/:id/history/:qid/reactivate', requirePerson, (req, res) => {
  const db = getDb();
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.qid);

  if (!q) return res.status(404).json({ error: 'Not found' });
  if (q.room_id !== req.params.id) return res.status(403).json({ error: 'Forbidden' });
  if (q.status !== 'drawn') return res.status(400).json({ error: 'Question is not drawn' });

  db.prepare(
    "UPDATE questions SET status = 'active', drawn_at = NULL, draw_order = NULL WHERE id = ?"
  ).run(req.params.qid);

  res.json({ id: q.id });
});

router.get('/:id/history', requirePerson, (req, res) => {
  const db = getDb();
  const questions = db.prepare(`
    SELECT q.id, q.text, q.drawn_at, q.draw_order, t.name as topic_name, t.color as topic_color
    FROM questions q
    LEFT JOIN topics t ON q.topic_id = t.id
    WHERE q.room_id = ? AND q.status = 'drawn'
    ORDER BY q.draw_order DESC
  `).all(req.params.id);
  res.json(questions);
});

export default router;
