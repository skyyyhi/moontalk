import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const [stacks, setStacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const currentToken = localStorage.getItem('moontalk_token');

  useEffect(() => {
    fetch('/api/stacks')
      .then(r => r.json())
      .then(data => { setStacks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function join(token) {
    localStorage.setItem('moontalk_token', token);
    navigate('/questions');
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-5 py-12">
      <div className="max-w-sm mx-auto">
        <div className="mb-10">
          <span className="text-3xl">🌙</span>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mt-3">moontalk</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Wer bist du?</p>
        </div>

        {loading ? (
          <div className="flex justify-center pt-12">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stacks.length === 0 ? (
          <p className="text-neutral-400 dark:text-neutral-600 text-sm text-center pt-12">
            Noch keine Stapel vorhanden.
          </p>
        ) : (
          <div className="space-y-4">
            {stacks.map(stack => (
              <div key={stack.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5">
                <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-4">
                  {stack.name}
                </p>
                <div className="flex gap-3">
                  {[
                    { name: stack.person_a_name, token: stack.person_a_token },
                    { name: stack.person_b_name, token: stack.person_b_token },
                  ].map(({ name, token }) => {
                    const active = token === currentToken;
                    return (
                      <button
                        key={token}
                        onClick={() => join(token)}
                        className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] ${
                          active
                            ? 'bg-brand text-white shadow-md'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {name}
                        {active && <span className="block text-xs font-normal opacity-80 mt-0.5">Du</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
