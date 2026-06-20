import { useState, useEffect, useCallback } from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import TopicBadge from '../components/TopicBadge';
import { api } from '../api';
import Navigation from '../components/Navigation';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function HistoryCard({ question, index, total, onReactivate }) {
  const [hover, setHover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleReactivate() {
    setLoading(true);
    try {
      await onReactivate(question.id);
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (done) return null;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`group bg-white dark:bg-neutral-900 border rounded-xl p-5 flex gap-4 transition-all duration-200 ${
        hover
          ? 'border-neutral-200 dark:border-neutral-700 shadow-card-hover'
          : 'border-neutral-100 dark:border-neutral-800 shadow-sm'
      }`}
    >
      <span className="shrink-0 w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 text-xs font-semibold flex items-center justify-center mt-0.5">
        {total - index}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-neutral-800 dark:text-neutral-100 text-sm font-medium leading-relaxed">
          {question.text}
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {question.topic_name && (
            <TopicBadge name={question.topic_name} color={question.topic_color} />
          )}
          {question.drawn_at && (
            <p className="text-neutral-400 dark:text-neutral-600 text-xs flex items-center gap-1">
              <Clock size={11} strokeWidth={1.5} />
              {formatDate(question.drawn_at)}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={handleReactivate}
        disabled={loading}
        title="Zurück in den Stapel"
        className="shrink-0 p-1.5 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-brand dark:hover:text-brand hover:bg-brand/5 dark:hover:bg-brand/10 transition-all duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-40 mt-0.5"
      >
        {loading
          ? <div className="w-4 h-4 border border-brand border-t-transparent rounded-full animate-spin" />
          : <RotateCcw size={15} />
        }
      </button>
    </div>
  );
}

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState(null);

  useEffect(() => { api.me().then(setPerson).catch(() => {}); }, []);

  const load = useCallback(() => {
    if (!person?.room_id) return;
    api.getHistory(person.room_id).then(setHistory).finally(() => setLoading(false));
  }, [person?.room_id]);

  useEffect(() => { load(); }, [load]);

  async function reactivate(qid) {
    await api.reactivate(person.room_id, qid);
    setHistory(h => h.filter(q => q.id !== qid));
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-28">
      <div className="safe-top" />

      <div className="max-w-lg mx-auto px-5">
        <header className="pt-10 pb-6">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Verlauf</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
            {loading ? '…' : history.length === 0
              ? 'Noch keine Karten gezogen'
              : `${history.length} ${history.length === 1 ? 'Karte' : 'Karten'} gezogen`}
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center pt-12">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center text-center pt-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <Clock size={24} className="text-neutral-300 dark:text-neutral-600" strokeWidth={1.5} />
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Hier erscheinen gezogene Karten
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {history.map((q, i) => (
              <div key={q.id} className="animate-fade-in">
                <HistoryCard
                  question={q}
                  index={i}
                  total={history.length}
                  onReactivate={reactivate}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}
