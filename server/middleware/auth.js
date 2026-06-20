import { getDb } from '../db.js';

export function requirePerson(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const db = getDb();
  const person = db.prepare('SELECT * FROM persons WHERE token = ?').get(token);
  if (!person) return res.status(401).json({ error: 'Invalid token' });

  if (req.params.id && req.params.id !== person.room_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  req.person = person;
  next();
}

export function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE admin_token = ?').get(token);
  if (!room) return res.status(401).json({ error: 'Invalid admin token' });

  if (req.params.id && req.params.id !== room.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  req.room = room;
  next();
}
