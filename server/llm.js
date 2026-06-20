import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';

let client;

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const TOPIC_COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#34d399',
  '#60a5fa', '#a78bfa', '#f472b6', '#2dd4bf',
];

function writeLog(db, roomId, questionId, text, status, extra = {}) {
  try {
    db.prepare(`
      INSERT INTO classify_log (id, room_id, question_id, question_text, topics_offered, llm_returned, matched_topic, status, error_msg)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(), roomId, questionId, text,
      extra.topicsOffered ? JSON.stringify(extra.topicsOffered) : null,
      extra.llmReturned ?? null,
      extra.matchedTopic ?? null,
      status,
      extra.errorMsg ?? null,
    );
  } catch { /* never fail on logging */ }
}

export async function classifyAndAssign(db, roomId, questionId, text, _client) {
  try {
    const client = _client ?? getClient();
    const enabledTopics = db.prepare(
      'SELECT id, name FROM topics WHERE room_id = ? AND (enabled = 1 OR enabled IS NULL)'
    ).all(roomId);

    if (enabledTopics.length === 0) {
      writeLog(db, roomId, questionId, text, 'no_topics');
      return;
    }

    const topicNames = enabledTopics.map(t => t.name);
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16,
      messages: [{
        role: 'user',
        content: `Du kategorisierst persönliche Gesprächsstarter-Fragen für zwei Menschen.
Verfügbare Kategorien: ${topicNames.join(', ')}

Frage: "${text}"

Antworte NUR mit einem der oben genannten Kategorienamen, exakt wie angegeben. Keine anderen Wörter.`,
      }],
    });

    const returned = response.content[0].text.trim().replace(/["\n]/g, '');
    const match = enabledTopics.find(t => t.name.toLowerCase() === returned.toLowerCase());

    if (!match) {
      writeLog(db, roomId, questionId, text, 'no_match', {
        topicsOffered: topicNames,
        llmReturned: returned,
      });
      return;
    }

    db.prepare('UPDATE questions SET topic_id = ? WHERE id = ?').run(match.id, questionId);
    writeLog(db, roomId, questionId, text, 'matched', {
      topicsOffered: topicNames,
      llmReturned: returned,
      matchedTopic: match.name,
    });
  } catch (err) {
    writeLog(db, roomId, questionId, text, 'error', { errorMsg: err.message });
    console.error('[LLM classify] Fehler:', err.message);
  }
}
