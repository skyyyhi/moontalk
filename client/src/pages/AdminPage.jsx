import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Sun, Moon, Sparkles, Plus, X, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useTheme } from '../contexts/ThemeContext';

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
      status === 'active'
        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500'
    }`}>
      {status === 'active' ? 'aktiv' : 'gezogen'}
    </span>
  );
}

function TopicBadge({ name, color }) {
  if (!name) return null;
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: color + '22', color }}
    >
      {name}
    </span>
  );
}

function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-150 ${
        active
          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
      }`}
    >
      {label}
    </button>
  );
}

const STATUS_CONFIG = {
  matched:   { dot: 'bg-emerald-500', label: (e) => `→ ${e.matched_topic}` },
  no_match:  { dot: 'bg-amber-400',   label: (e) => `→ kein Match (LLM: "${e.llm_returned}")` },
  no_topics: { dot: 'bg-neutral-300 dark:bg-neutral-600', label: () => '→ keine Kategorien aktiv' },
  error:     { dot: 'bg-red-500',     label: (e) => `→ Fehler: ${e.error_msg}` },
};

function ClassifyLogEntry({ entry }) {
  const cfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.error;
  const topics = entry.topics_offered ? JSON.parse(entry.topics_offered) : [];
  const ago = (() => {
    const s = Math.round((Date.now() - new Date(entry.created_at + 'Z')) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}min`;
    return `${Math.floor(s / 3600)}h`;
  })();

  return (
    <div className="px-3 py-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors">
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-neutral-800 dark:text-neutral-200 font-medium truncate">
            „{entry.question_text}"
          </p>
          <p className={`text-xs mt-0.5 ${entry.status === 'matched' ? 'text-emerald-600 dark:text-emerald-400' : entry.status === 'error' ? 'text-red-500' : 'text-neutral-400'}`}>
            {cfg.label(entry)}
          </p>
          {topics.length > 0 && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">
              Angeboten: {topics.join(', ')}
            </p>
          )}
        </div>
        <span className="text-xs text-neutral-300 dark:text-neutral-600 shrink-0">{ago}</span>
      </div>
    </div>
  );
}

function Toggle({ enabled, onChange, loading }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
        enabled ? 'bg-brand' : 'bg-neutral-200 dark:bg-neutral-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function AdminPage() {
  const { adminToken } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [togglingCateg, setTogglingCateg] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classifyDone, setClassifyDone] = useState(null);
  const [newTopicName, setNewTopicName] = useState('');
  const [addingTopic, setAddingTopic] = useState(false);
  const [classifyLog, setClassifyLog] = useState([]);
  const [logVisible, setLogVisible] = useState(false);
  const [pollingLog, setPollingLog] = useState(false);
  const pollRef = useRef(null);
  const newTopicRef = useRef(null);
  const { dark, toggle } = useTheme();

  useEffect(() => {
    if (!adminToken) return;
    fetch('/api/admin-lookup', { headers: { Authorization: `Bearer ${adminToken}` } })
      .then(r => r.json())
      .then(({ room_id }) => {
        setRoomId(room_id);
        return api.getAdmin(room_id, adminToken);
      })
      .then(setData)
      .catch(() => setError('Ungültiger Admin-Link'));
  }, [adminToken]);

  async function toggleAutoCateg(value) {
    setTogglingCateg(true);
    try {
      await api.updateSettings(roomId, adminToken, { auto_categorize: value });
      setData(d => ({ ...d, room: { ...d.room, auto_categorize: value ? 1 : 0 } }));
    } finally {
      setTogglingCateg(false);
    }
  }

  async function handleAddTopic(e) {
    e.preventDefault();
    if (!newTopicName.trim() || addingTopic) return;
    setAddingTopic(true);
    try {
      const topic = await api.createTopic(roomId, adminToken, newTopicName.trim());
      if (!topic.error) {
        setData(d => ({ ...d, topics: [...d.topics, topic].sort((a, b) => a.name.localeCompare(b.name)) }));
        setNewTopicName('');
        newTopicRef.current?.focus();
      }
    } finally {
      setAddingTopic(false);
    }
  }

  async function handleToggleTopic(topicId) {
    const result = await api.toggleTopic(roomId, adminToken, topicId);
    setData(d => ({
      ...d,
      topics: d.topics.map(t => t.id === topicId ? { ...t, enabled: result.enabled } : t),
    }));
  }

  async function handleDeleteTopic(topicId) {
    const deletedTopic = data.topics.find(t => t.id === topicId);
    await api.deleteTopic(roomId, adminToken, topicId);
    setData(d => ({
      ...d,
      topics: d.topics.filter(t => t.id !== topicId),
      questions: d.questions.map(q => q.topic_id === topicId ? { ...q, topic_name: null, topic_color: null, topic_id: null } : q),
    }));
    if (deletedTopic && topicFilter === deletedTopic.name) setTopicFilter(null);
  }

  const fetchLog = useCallback(async () => {
    if (!roomId) return;
    const logs = await api.getClassifyLog(roomId, adminToken);
    setClassifyLog(logs);
    return logs;
  }, [roomId, adminToken]);

  function startPolling(expectedCount) {
    setPollingLog(true);
    setLogVisible(true);
    let seen = 0;
    pollRef.current = setInterval(async () => {
      const logs = await fetchLog();
      const newSeen = logs.filter(l => ['matched', 'no_match', 'no_topics', 'error'].includes(l.status)).length;
      if (newSeen >= seen + expectedCount || (newSeen > seen && seen > 0 && newSeen === logs.length)) {
        clearInterval(pollRef.current);
        setPollingLog(false);
        setClassifying(false);
        // Refresh stats
        api.getAdmin(roomId, adminToken).then(setData);
      }
      seen = newSeen;
    }, 1200);
    // Safety stop after 3 min
    setTimeout(() => {
      clearInterval(pollRef.current);
      setPollingLog(false);
      setClassifying(false);
    }, 180000);
  }

  async function handleClassifyAll() {
    setClassifying(true);
    setClassifyDone(null);
    await fetchLog();
    setLogVisible(true);
    try {
      const { queued } = await api.classifyAll(roomId, adminToken);
      setClassifyDone(queued);
      if (queued > 0) {
        startPolling(queued);
      } else {
        setClassifying(false);
      }
    } catch {
      setClassifying(false);
    }
  }

  async function handleClearLog() {
    await api.clearClassifyLog(roomId, adminToken);
    setClassifyLog([]);
  }

  useEffect(() => () => clearInterval(pollRef.current), []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <p className="text-neutral-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filtered = data.questions
    .filter(q => filter === 'all' || q.status === filter)
    .filter(q => topicFilter === null || q.topic_name === topicFilter);
  const autoCateg = !!data.room?.auto_categorize;

  // Nur Themen anzeigen, die auch tatsächlich in Fragen vorkommen
  const topicsInQuestions = [...new Map(
    data.questions.filter(q => q.topic_name).map(q => [q.topic_name, { name: q.topic_name, color: q.topic_color }])
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto px-5 py-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🌙</span>
              <div>
                <p className="text-xs font-semibold text-brand uppercase tracking-wider">Admin</p>
                <h1 className="text-lg font-bold text-neutral-900 dark:text-white leading-tight">
                  {data.room?.name}
                </h1>
              </div>
            </div>
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-full border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              {dark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {[
              { label: 'Gesamt', value: data.stats.total, color: 'text-neutral-900 dark:text-white' },
              { label: 'Aktiv', value: data.stats.active, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Gezogen', value: data.stats.drawn, color: 'text-neutral-400' },
              { label: 'Kategorisiert', value: data.stats.categorized, color: 'text-purple-600 dark:text-purple-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-neutral-500 dark:text-neutral-400 text-xs mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* Auto-categorize toggle */}
          <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800 rounded-xl px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center">
                <Sparkles size={15} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  Automatische Kategorisierung
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5">
                  Neue Fragen per KI einordnen
                </p>
              </div>
            </div>
            <Toggle enabled={autoCateg} onChange={toggleAutoCateg} loading={togglingCateg} />
          </div>

          {/* Classify all button */}
          <div className="mt-3">
            <button
              onClick={handleClassifyAll}
              disabled={classifying || data.topics.filter(t => t.enabled).length === 0}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-sm font-semibold py-3 rounded-xl transition-colors duration-150"
            >
              {classifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Wird gestartet…
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  {data.stats.total - data.stats.categorized > 0
                    ? `${data.stats.total - data.stats.categorized} Fragen kategorisieren`
                    : 'Alle Fragen neu kategorisieren'}
                </>
              )}
            </button>
            {data.topics.filter(t => t.enabled).length === 0 && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center mt-2">
                Erst Kategorien anlegen und aktivieren
              </p>
            )}
            {classifyDone === 0 && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center mt-2">
                Keine unkategorisierten Fragen gefunden.
              </p>
            )}

            {/* Log toggle */}
            <button
              onClick={async () => { if (!logVisible) await fetchLog(); setLogVisible(v => !v); }}
              className="w-full mt-2 text-xs text-purple-600 dark:text-purple-400 hover:underline text-center"
            >
              {logVisible ? 'Protokoll ausblenden' : 'KI-Protokoll anzeigen'}
              {classifyLog.length > 0 && ` (${classifyLog.length})`}
            </button>
          </div>

          {/* Classify log */}
          {logVisible && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                  KI-Protokoll
                  {pollingLog && <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />}
                </p>
                {classifyLog.length > 0 && (
                  <button onClick={handleClearLog} className="text-neutral-400 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                {classifyLog.length === 0 ? (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-6">
                    Noch keine Einträge
                  </p>
                ) : (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                    {classifyLog.map(entry => (
                      <ClassifyLogEntry key={entry.id} entry={entry} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Categories management */}
          <div className="mt-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
              Kategorien
            </p>

            <div className="space-y-1.5 mb-3">
              {data.topics.length === 0 ? (
                <p className="text-xs text-neutral-400 dark:text-neutral-500">Noch keine Kategorien angelegt.</p>
              ) : (
                data.topics.map(t => (
                  <div key={t.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => handleToggleTopic(t.id)}
                      className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 text-left ${
                        t.enabled
                          ? 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200'
                          : 'bg-neutral-100 dark:bg-neutral-700/50 border border-transparent text-neutral-400 dark:text-neutral-500'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: t.enabled ? t.color : '#9ca3af' }}
                      />
                      <span className={t.enabled ? '' : 'line-through'}>{t.name}</span>
                      {!t.enabled && (
                        <span className="ml-auto text-xs">aus</span>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteTopic(t.id)}
                      className="p-1.5 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      aria-label="Kategorie löschen"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddTopic} className="flex gap-2">
              <input
                ref={newTopicRef}
                value={newTopicName}
                onChange={e => setNewTopicName(e.target.value)}
                placeholder="Neue Kategorie…"
                className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
              <button
                type="submit"
                disabled={!newTopicName.trim() || addingTopic}
                className="px-3 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-neutral-700 dark:hover:bg-neutral-100 transition-colors"
              >
                <Plus size={16} />
              </button>
            </form>
          </div>

        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-5">
        {/* Status filter */}
        <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Status</p>
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
          <FilterPill label="Alle" active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterPill label="Aktiv" active={filter === 'active'} onClick={() => setFilter('active')} />
          <FilterPill label="Gezogen" active={filter === 'drawn'} onClick={() => setFilter('drawn')} />
        </div>

        {/* Topic filter — only shows topics that appear in at least one question */}
        {topicsInQuestions.length > 0 && (
          <>
            <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Thema</p>
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setTopicFilter(null)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150 ${
                  topicFilter === null
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                Alle
              </button>
              {topicsInQuestions.map(t => (
                <button
                  key={t.name}
                  onClick={() => setTopicFilter(topicFilter === t.name ? null : t.name)}
                  className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer"
                  style={topicFilter === t.name
                    ? { backgroundColor: t.color, color: '#fff' }
                    : { backgroundColor: t.color + '22', color: t.color }
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Question list */}
        <div className="space-y-2.5">
          {filtered.length === 0 ? (
            <p className="text-neutral-400 text-sm text-center py-10">Keine Einträge</p>
          ) : (
            filtered.map(q => (
              <div
                key={q.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-xl p-4 hover:shadow-card hover:border-neutral-200 dark:hover:border-neutral-700 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-neutral-800 dark:text-neutral-100 text-sm font-medium leading-relaxed flex-1">
                    {q.text}
                  </p>
                  <StatusBadge status={q.status} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-500 bg-neutral-50 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
                    {q.person_name}
                  </span>
                  {q.topic_name && <TopicBadge name={q.topic_name} color={q.topic_color} />}
                  {q.source === 'llm' && (
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded-md">
                      ✦ KI-generiert
                    </span>
                  )}
                  {q.draw_order && (
                    <span className="text-xs text-neutral-400">#{q.draw_order}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
