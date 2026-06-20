import express from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { classifyAndAssign, TOPIC_COLORS } from '../llm.js';

const router = express.Router();

router.get('/:id/admin', requireAdmin, (req, res) => {
  const db = getDb();

  const room = db.prepare('SELECT id, name, created_at, auto_categorize FROM rooms WHERE id = ?').get(req.params.id);
  const persons = db.prepare('SELECT id, display_name, created_at FROM persons WHERE room_id = ?').all(req.params.id);
  const topics = db.prepare('SELECT id, name, color, enabled FROM topics WHERE room_id = ? ORDER BY name').all(req.params.id);
  const questions = db.prepare(`
    SELECT q.id, q.text, q.status, q.source, q.created_at, q.drawn_at, q.draw_order,
           q.topic_id,
           p.display_name as person_name,
           t.name as topic_name, t.color as topic_color
    FROM questions q
    JOIN persons p ON q.person_id = p.id
    LEFT JOIN topics t ON q.topic_id = t.id
    WHERE q.room_id = ?
    ORDER BY q.created_at DESC
  `).all(req.params.id);

  const stats = {
    total: questions.length,
    active: questions.filter(q => q.status === 'active').length,
    drawn: questions.filter(q => q.status === 'drawn').length,
    categorized: questions.filter(q => q.topic_name).length,
  };

  res.json({ room, persons, topics, questions, stats });
});

router.post('/:id/classify-all', requireAdmin, (req, res) => {
  const db = getDb();
  const unclassified = db.prepare(
    'SELECT id, text FROM questions WHERE room_id = ? AND topic_id IS NULL'
  ).all(req.params.id);

  res.json({ queued: unclassified.length });

  // Sequenziell im Hintergrund — vermeidet Rate-Limit-Probleme
  ;(async () => {
    for (const q of unclassified) {
      await classifyAndAssign(db, req.params.id, q.id, q.text);
    }
    console.log(`[classify-all] ${unclassified.length} Fragen klassifiziert für Raum ${req.params.id}`);
  })();
});

router.post('/:id/topics', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM topics WHERE room_id = ? AND name = ?').get(req.params.id, name.trim());
  if (existing) return res.status(409).json({ error: 'Kategorie existiert bereits' });

  const allTopics = db.prepare('SELECT id FROM topics WHERE room_id = ?').all(req.params.id);
  const color = TOPIC_COLORS[allTopics.length % TOPIC_COLORS.length];
  const id = randomUUID();
  db.prepare('INSERT INTO topics (id, room_id, name, color, enabled) VALUES (?, ?, ?, ?, 1)').run(
    id, req.params.id, name.trim(), color
  );
  res.status(201).json({ id, name: name.trim(), color, enabled: 1 });
});

router.patch('/:id/topics/:tid/toggle', requireAdmin, (req, res) => {
  const db = getDb();
  const topic = db.prepare('SELECT id, enabled FROM topics WHERE id = ? AND room_id = ?').get(req.params.tid, req.params.id);
  if (!topic) return res.status(404).json({ error: 'Not found' });

  const newEnabled = topic.enabled ? 0 : 1;
  db.prepare('UPDATE topics SET enabled = ? WHERE id = ?').run(newEnabled, topic.id);
  res.json({ id: topic.id, enabled: newEnabled });
});

router.delete('/:id/topics/:tid', requireAdmin, (req, res) => {
  const db = getDb();
  const topic = db.prepare('SELECT id FROM topics WHERE id = ? AND room_id = ?').get(req.params.tid, req.params.id);
  if (!topic) return res.status(404).json({ error: 'Not found' });

  db.prepare('UPDATE questions SET topic_id = NULL WHERE topic_id = ?').run(topic.id);
  db.prepare('DELETE FROM topics WHERE id = ?').run(topic.id);
  res.status(204).end();
});

router.get('/:id/classify-log', requireAdmin, (req, res) => {
  const db = getDb();
  const logs = db.prepare(
    'SELECT * FROM classify_log WHERE room_id = ? ORDER BY created_at DESC LIMIT 100'
  ).all(req.params.id);
  res.json(logs);
});

router.delete('/:id/classify-log', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM classify_log WHERE room_id = ?').run(req.params.id);
  res.status(204).end();
});

router.patch('/:id/settings', requireAdmin, (req, res) => {
  const { auto_categorize } = req.body;
  if (typeof auto_categorize !== 'boolean') {
    return res.status(400).json({ error: 'auto_categorize (boolean) required' });
  }

  const db = getDb();
  db.prepare('UPDATE rooms SET auto_categorize = ? WHERE id = ?').run(
    auto_categorize ? 1 : 0, req.params.id
  );

  res.json({ auto_categorize });
});

export default router;
