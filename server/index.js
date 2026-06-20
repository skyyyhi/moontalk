import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { getDb } from './db.js';
import roomsRouter from './routes/rooms.js';
import questionsRouter from './routes/questions.js';
import drawRouter from './routes/draw.js';
import adminRouter from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

getDb();

app.use(express.json());

app.use('/api/rooms', roomsRouter);
app.use('/api/rooms', questionsRouter);
app.use('/api/rooms', drawRouter);
app.use('/api/rooms', adminRouter);

app.get('/api/admin-lookup', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const db = getDb();
  const room = db.prepare('SELECT id as room_id FROM rooms WHERE admin_token = ?').get(token);
  if (!room) return res.status(401).json({ error: 'Invalid admin token' });

  res.json(room);
});

app.get('/api/stacks', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT r.id, r.name,
           p1.display_name as person_a_name, p1.token as person_a_token,
           p2.display_name as person_b_name, p2.token as person_b_token
    FROM rooms r
    JOIN persons p1 ON p1.room_id = r.id
    JOIN persons p2 ON p2.room_id = r.id AND p2.id != p1.id
    WHERE p1.id < p2.id
    ORDER BY r.created_at DESC
  `).all();
  res.json(rows);
});

app.get('/api/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const db = getDb();
  const person = db.prepare('SELECT id, room_id, display_name FROM persons WHERE token = ?').get(token);
  if (!person) return res.status(401).json({ error: 'Invalid token' });

  res.json(person);
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Moontalk running on http://localhost:${PORT}`);
});
