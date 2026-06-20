const BASE = '/api';

function getToken() {
  return localStorage.getItem('moontalk_token');
}

async function request(method, path, body, extraHeaders = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Netzwerkfehler' }));
    throw new Error(err.error || 'Anfrage fehlgeschlagen');
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  me: () => request('GET', '/me'),

  createRoom: (data, adminSecret) =>
    request('POST', '/rooms', data, { 'x-admin-secret': adminSecret }),

  getQuestions: (roomId) => request('GET', `/rooms/${roomId}/questions`),
  addQuestion: (roomId, text) => request('POST', `/rooms/${roomId}/questions`, { text }),
  deleteQuestion: (roomId, qid) => request('DELETE', `/rooms/${roomId}/questions/${qid}`),

  getDrawTopics: (roomId) => request('GET', `/rooms/${roomId}/draw/topics`),
  getDrawCount: (roomId, topicId) => request('GET', `/rooms/${roomId}/draw/count${topicId ? `?topic_id=${topicId}` : ''}`),
  draw: (roomId, topicId) => request('POST', `/rooms/${roomId}/draw`, topicId ? { topic_id: topicId } : undefined),
  getHistory: (roomId) => request('GET', `/rooms/${roomId}/history`),
  reactivate: (roomId, qid) => request('POST', `/rooms/${roomId}/history/${qid}/reactivate`),

  getAdmin: (roomId, adminToken) =>
    fetch(`${BASE}/rooms/${roomId}/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(r => r.json()),

  createTopic: (roomId, adminToken, name) =>
    fetch(`${BASE}/rooms/${roomId}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name }),
    }).then(r => r.json()),

  toggleTopic: (roomId, adminToken, topicId) =>
    fetch(`${BASE}/rooms/${roomId}/topics/${topicId}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(r => r.json()),

  deleteTopic: (roomId, adminToken, topicId) =>
    fetch(`${BASE}/rooms/${roomId}/topics/${topicId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    }),

  getClassifyLog: (roomId, adminToken) =>
    fetch(`${BASE}/rooms/${roomId}/classify-log`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(r => r.json()),

  clearClassifyLog: (roomId, adminToken) =>
    fetch(`${BASE}/rooms/${roomId}/classify-log`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    }),

  classifyAll: (roomId, adminToken) =>
    fetch(`${BASE}/rooms/${roomId}/classify-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then(r => r.json()),

  updateSettings: (roomId, adminToken, settings) =>
    fetch(`${BASE}/rooms/${roomId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(settings),
    }).then(r => r.json()),
};
