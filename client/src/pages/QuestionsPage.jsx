import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, X, MessageCircle } from 'lucide-react';
import { api } from '../api';
import Navigation from '../components/Navigation';
import SwipeableCard from '../components/SwipeableCard';
import TopicBadge from '../components/TopicBadge';

function QuestionCard({ question, onDelete }) {
  const [hover, setHover] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await onDelete(question.id);
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`group border rounded-xl p-5 flex items-start gap-4 transition-all duration-200 bg-white dark:bg-neutral-900 ${
        hover
          ? 'border-neutral-200 dark:border-neutral-700 shadow-card-hover'
          : 'border-neutral-100 dark:border-neutral-800 shadow-sm'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-neutral-800 dark:text-neutral-100 text-sm leading-relaxed font-medium">
          {question.text}
        </p>
        {question.topic_name && (
          <div className="mt-2">
            <TopicBadge name={question.topic_name} color={question.topic_color} />
          </div>
        )}
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="shrink-0 p-1 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Frage löschen"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [person, setPerson] = useState(null);
  const [topicFilter, setTopicFilter] = useState(null);
  const textareaRef = useRef(null);

  const topics = [...new Map(
    questions.filter(q => q.topic_name).map(q => [q.topic_name, { name: q.topic_name, color: q.topic_color }])
  ).values()];

  const visibleQuestions = topicFilter
    ? questions.filter(q => q.topic_name === topicFilter)
    : questions;

  useEffect(() => { api.me().then(setPerson).catch(() => {}); }, []);

  const load = useCallback(() => {
    if (!person?.room_id) return;
    api.getQuestions(person.room_id).then(setQuestions).finally(() => setLoading(false));
  }, [person?.room_id]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const newQ = await api.addQuestion(person.room_id, text);
      setQuestions(qs => [{ ...newQ, created_at: new Date().toISOString() }, ...qs]);
      setText('');
      textareaRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function deleteQuestion(id) {
    await api.deleteQuestion(person.room_id, id);
    setQuestions(qs => qs.filter(q => q.id !== id));
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-28">
      <div className="safe-top" />

      <div className="max-w-lg mx-auto px-5">
        <header className="pt-10 pb-6">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Meine Fragen</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
            {loading ? '…' : questions.length === 0
              ? 'Noch keine Fragen hinzugefügt'
              : `${questions.length} ${questions.length === 1 ? 'Frage' : 'Fragen'} im Stapel`}
          </p>
        </header>

        {/* Topic filter pills */}
        {!loading && topics.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
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
            {topics.map(t => (
              <button
                key={t.name}
                onClick={() => setTopicFilter(topicFilter === t.name ? null : t.name)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
                style={topicFilter === t.name
                  ? { backgroundColor: t.color, color: '#fff' }
                  : { backgroundColor: t.color + '22', color: t.color }
                }
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2.5">
          {loading ? (
            <div className="flex justify-center pt-12">
              <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : questions.length === 0 ? (
            <div className="flex flex-col items-center text-center pt-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <MessageCircle size={24} className="text-neutral-300 dark:text-neutral-600" strokeWidth={1.5} />
              </div>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                Füge deine erste Frage hinzu
              </p>
            </div>
          ) : (
            visibleQuestions.map(q => (
              <div key={q.id} className="animate-fade-in">
                <SwipeableCard onDelete={() => deleteQuestion(q.id)}>
                  <QuestionCard question={q} onDelete={deleteQuestion} />
                </SwipeableCard>
              </div>
            ))
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-24 right-5 w-14 h-14 bg-brand hover:bg-brand-hover text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all duration-150"
        aria-label="Frage hinzufügen"
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {/* Add question sheet */}
      {showAdd && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAdd(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-3xl shadow-2xl animate-slide-up safe-bottom">
            <div className="max-w-lg mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Neue Frage</h2>
                <button
                  onClick={() => setShowAdd(false)}
                  className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={e => { e.preventDefault(); submit(); }}>
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  enterKeyHint="send"
                  placeholder="Was möchtest du fragen?"
                  rows={3}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3.5 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none transition"
                />
                <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-2 mb-3">
                  Enter zum Speichern · Shift+Enter für Zeilenumbruch
                </p>
                <button
                  type="submit"
                  disabled={!text.trim() || submitting}
                  className="w-full bg-brand hover:bg-brand-hover disabled:opacity-40 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors duration-150 active:scale-[0.98]"
                >
                  {submitting ? 'Speichern…' : 'Hinzufügen'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}
