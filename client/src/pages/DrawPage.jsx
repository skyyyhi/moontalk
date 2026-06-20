import { useState, useEffect, useCallback } from 'react';
import { Shuffle, ChevronRight } from 'lucide-react';
import TopicBadge from '../components/TopicBadge';
import { api } from '../api';
import Navigation from '../components/Navigation';

function CardStack({ onDraw, drawing }) {
  return (
    <button
      onClick={onDraw}
      disabled={drawing}
      className="relative w-64 h-80 group disabled:opacity-60 focus:outline-none"
      aria-label="Karte ziehen"
    >
      <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-700 rounded-2xl transform rotate-3 translate-y-3 shadow-sm" />
      <div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-800 rounded-2xl transform -rotate-2 translate-y-1.5 shadow-sm" />

      <div className="absolute inset-0 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-700 rounded-2xl shadow-card flex flex-col items-center justify-center gap-4 group-hover:shadow-card-hover group-active:scale-[0.97] transition-all duration-200">
        {drawing ? (
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-brand/8 dark:bg-brand/10 flex items-center justify-center">
              <Shuffle size={26} className="text-brand" strokeWidth={1.75} />
            </div>
            <div className="text-center px-6">
              <p className="text-neutral-800 dark:text-neutral-200 font-semibold text-sm">Tippen zum Ziehen</p>
              <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-1">aus dem gemeinsamen Stapel</p>
            </div>
          </>
        )}
      </div>
    </button>
  );
}

function RevealedCard({ text, topicName, topicColor }) {
  return (
    <div className="w-full max-w-sm animate-card-reveal">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-700 rounded-2xl shadow-card-hover p-8 min-h-[200px] flex flex-col items-center justify-center gap-4">
        <p className="text-neutral-800 dark:text-neutral-100 text-xl font-semibold leading-relaxed text-center">
          {text}
        </p>
        {topicName && <TopicBadge name={topicName} color={topicColor} />}
      </div>
    </div>
  );
}

export default function DrawPage() {
  const [count, setCount] = useState(null);
  const [drawn, setDrawn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [person, setPerson] = useState(null);
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);

  useEffect(() => { api.me().then(setPerson).catch(() => {}); }, []);

  const loadTopics = useCallback(() => {
    if (!person?.room_id) return;
    api.getDrawTopics(person.room_id).then(setTopics).catch(() => {});
  }, [person?.room_id]);

  const loadCount = useCallback(() => {
    if (!person?.room_id) return;
    api.getDrawCount(person.room_id, selectedTopic).then(r => setCount(r.count)).finally(() => setLoading(false));
  }, [person?.room_id, selectedTopic]);

  useEffect(() => { loadTopics(); }, [loadTopics]);
  useEffect(() => { loadCount(); }, [loadCount]);

  async function draw() {
    setDrawing(true);
    setDrawn(null);
    try {
      const card = await api.draw(person.room_id, selectedTopic);
      setDrawn(card);
      setCount(c => Math.max(0, c - 1));
      loadTopics();
    } catch (err) {
      if (err.message.includes('verfügbar')) setCount(0);
    } finally {
      setDrawing(false);
    }
  }

  function selectTopic(topicId) {
    setSelectedTopic(topicId);
    setDrawn(null);
  }

  const activeTopics = topics.filter(t => t.count > 0);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-28">
      <div className="safe-top" />

      <div className="max-w-lg mx-auto px-5">
        <header className="pt-10 pb-4">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Karte ziehen</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
            {loading ? '…' : count === 0
              ? 'Keine Karten in dieser Auswahl'
              : `${count} ${count === 1 ? 'Karte' : 'Karten'} im Stapel`}
          </p>
        </header>

        {activeTopics.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-3">
            <button
              onClick={() => selectTopic(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150 ${
                selectedTopic === null
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              Alle
            </button>
            {activeTopics.map(t => (
              <button
                key={t.id}
                onClick={() => selectTopic(selectedTopic === t.id ? null : t.id)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
                style={selectedTopic === t.id
                  ? { backgroundColor: t.color, color: '#fff' }
                  : { backgroundColor: t.color + '22', color: t.color }
                }
              >
                {t.name}
                <span className="ml-1.5 opacity-70">{t.count}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col items-center gap-8 pt-6">
          {loading ? (
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          ) : drawn ? (
            <>
              <RevealedCard text={drawn.text} topicName={drawn.topic_name} topicColor={drawn.topic_color} />

              <div className="w-full max-w-sm flex flex-col gap-2.5">
                {count > 0 && (
                  <button
                    onClick={draw}
                    disabled={drawing}
                    className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-sm transition-colors duration-150 active:scale-[0.98]"
                  >
                    Nächste Karte
                    <ChevronRight size={16} />
                  </button>
                )}
                <button
                  onClick={() => setDrawn(null)}
                  className="w-full border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 font-medium py-4 rounded-xl text-sm hover:bg-white dark:hover:bg-neutral-900 hover:shadow-card transition-all duration-200 active:scale-[0.98]"
                >
                  Fertig
                </button>
              </div>
            </>
          ) : count === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-3xl mx-auto mb-4">
                🌑
              </div>
              <p className="text-neutral-800 dark:text-neutral-200 font-semibold">Stapel leer</p>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1 max-w-xs">
                {selectedTopic
                  ? 'Keine Karten in dieser Kategorie.'
                  : 'Fügt mehr Fragen hinzu, um weiterzumachen.'}
              </p>
            </div>
          ) : (
            <CardStack onDraw={draw} drawing={drawing} />
          )}
        </div>
      </div>

      <Navigation />
    </div>
  );
}
