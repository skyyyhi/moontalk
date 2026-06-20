import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { api } from '../api';

function InputField({ label, type = 'text', placeholder, value, onChange, required }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3.5 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
      />
    </div>
  );
}

function rebaseUrl(serverUrl) {
  try {
    const u = new URL(serverUrl);
    return window.location.origin + u.pathname;
  } catch {
    return serverUrl;
  }
}

function LinkCard({ label, url }) {
  url = rebaseUrl(url);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 hover:shadow-card transition-shadow duration-200 bg-white dark:bg-neutral-900">
      <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-neutral-700 dark:text-neutral-300 text-sm font-mono break-all leading-relaxed mb-3">
        {url}
      </p>
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-hover transition-colors"
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? 'Kopiert' : 'Kopieren'}
      </button>
    </div>
  );
}

export default function SetupPage() {
  const [form, setForm] = useState({ name: '', person_a_name: '', person_b_name: '', secret: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.createRoom(
        { name: form.name, person_a_name: form.person_a_name, person_b_name: form.person_b_name },
        form.secret
      );
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-5 py-10 animate-fade-in">
        <div className="max-w-lg mx-auto">
          <div className="mb-8">
            <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center text-2xl mb-5">
              🌙
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Stapel erstellt</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
              Teile die Links mit der anderen Person. Den Admin-Link nur für dich behalten.
            </p>
          </div>

          <div className="space-y-3">
            <LinkCard label={result.person_a.name} url={result.person_a.url} />
            <LinkCard label={result.person_b.name} url={result.person_b.url} />
            <LinkCard label="Admin" url={result.admin_url} />
          </div>

          <button
            onClick={() => setResult(null)}
            className="mt-6 w-full border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 font-medium py-3.5 rounded-xl text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Neuen Stapel erstellen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-10">
        <div className="max-w-sm w-full mx-auto">
          <div className="mb-8">
            <span className="text-3xl">🌙</span>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mt-3">moontalk</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Neuen Stapel erstellen</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField label="Name des Stapels" placeholder="z. B. Yannick & Lena" value={form.name} onChange={set('name')} required />
            <InputField label="Person A — Name" placeholder="Dein Name" value={form.person_a_name} onChange={set('person_a_name')} required />
            <InputField label="Person B — Name" placeholder="Name der anderen Person" value={form.person_b_name} onChange={set('person_b_name')} required />
            <InputField label="Admin-Passwort" type="password" placeholder="Aus der .env Datei" value={form.secret} onChange={set('secret')} required />

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-sm transition-colors duration-150 active:scale-[0.98] mt-2"
            >
              {loading ? 'Erstelle...' : 'Stapel erstellen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
