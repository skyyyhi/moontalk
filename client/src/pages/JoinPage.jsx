import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function JoinPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    localStorage.setItem('moontalk_token', token);
    api.me()
      .then(setPerson)
      .catch(() => {
        localStorage.removeItem('moontalk_token');
        setError('Dieser Einladungslink ist ungültig.');
      });
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white dark:bg-neutral-950">
        <p className="text-neutral-500 dark:text-neutral-400">{error}</p>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-neutral-950 animate-fade-in">
      {/* Hero section */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 flex items-center justify-center text-3xl mb-8 shadow-card">
          🌙
        </div>

        <p className="text-sm font-semibold text-brand uppercase tracking-widest mb-3">
          moontalk
        </p>

        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-3 leading-tight">
          Willkommen,<br />{person.display_name}
        </h1>

        <p className="text-neutral-500 dark:text-neutral-400 text-base leading-relaxed max-w-xs">
          Sammle Fragen für eure nächsten Gespräche — was du hinzufügst, bleibt bis zum Ziehen verborgen.
        </p>
      </div>

      {/* Bottom CTA */}
      <div className="px-6 pb-12 safe-bottom">
        <button
          onClick={() => navigate('/questions', { replace: true })}
          className="w-full bg-brand hover:bg-brand-hover text-white font-semibold py-4 rounded-xl text-base transition-colors duration-150 active:scale-[0.98]"
        >
          Los geht's
        </button>

        <p className="text-center text-neutral-400 dark:text-neutral-600 text-xs mt-4">
          Dein Link bleibt aktiv — komm jederzeit wieder
        </p>
      </div>
    </div>
  );
}
