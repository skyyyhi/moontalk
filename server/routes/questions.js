import express from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db.js';
import { requirePerson } from '../middleware/auth.js';
import { classifyAndAssign } from '../llm.js';

const router = express.Router();

router.get('/:id/questions', requirePerson, (req, res) => {
  const db = getDb();
  const questions = db.prepare(`
    SELECT q.id, q.text, q.created_at, t.name as topic_name, t.color as topic_color
    FROM questions q
    LEFT JOIN topics t ON q.topic_id = t.id
    WHERE q.room_id = ? AND q.person_id = ? AND q.status = 'active'
    ORDER BY q.created_at DESC
  `).all(req.params.id, req.person.id);
  res.json(questions);
});

router.post('/:id/questions', requirePerson, (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });

  const db = getDb();
  const id = randomUUID();
  db.prepare('INSERT INTO questions (id, room_id, person_id, text) VALUES (?, ?, ?, ?)').run(
    id, req.params.id, req.person.id, text.trim()
  );

  res.status(201).json({ id, text: text.trim() });

  // Asynchrone Klassifizierung — Antwort ist bereits gesendet
  const room = db.prepare('SELECT auto_categorize FROM rooms WHERE id = ?').get(req.params.id);
  if (room?.auto_categorize) {
    classifyAndAssign(db, req.params.id, id, text.trim());
  }
});

router.delete('/:id/questions/:qid', requirePerson, (req, res) => {
  const db = getDb();
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.qid);

  if (!q) return res.status(404).json({ error: 'Not found' });
  if (q.person_id !== req.person.id) return res.status(403).json({ error: 'Forbidden' });
  if (q.room_id !== req.params.id) return res.status(403).json({ error: 'Forbidden' });
  if (q.status !== 'active') return res.status(400).json({ error: 'Cannot delete drawn question' });

  db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.qid);
  res.status(204).end();
});

export default router;
