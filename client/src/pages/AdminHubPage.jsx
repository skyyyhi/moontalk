import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, X } from 'lucide-react';
import { api } from '../api';

function rebaseUrl(path) {
  return window.location.origin + '/moontalk' + path;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

function StackCard({ room, secret }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(null);

  const links = [
    { label: room.person_a_name, url: rebaseUrl(`/join/${room.person_a_token}`) },
    { label: room.person_b_name, url: rebaseUrl(`/join/${room.person_b_token}`) },
  ];

  async function copy(url, key) {
    await copyText(url);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
      >
        <div className="text-left">
          <p className="font-semibold text-neutral-900 dark:text-white">{room.name}</p>
          <p className="text-xs text-neutral-400 mt-0.5">{room.person_a_name} & {room.person_b_name}</p>
        </div>
        <ChevronRight size={16} className={`text-neutral-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 px-5 py-4 space-y-3">
          {links.map(({ label, url }) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{label}</p>
                <p className="text-xs font-mono text-neutral-600 dark:text-neutral-400 truncate">{url}</p>
              </div>
              <button
                onClick={() => copy(url, label)}
                className="shrink-0 text-xs font-semibold text-brand hover:text-brand-hover px-2 py-1 rounded-lg bg-brand/5 hover:bg-brand/10 transition-colors"
              >
                {copied === label ? 'Kopiert' : 'Kopieren'}
              </button>
            </div>
          ))}
          <button
            onClick={() => navigate(`/admin/${room.admin_token}`)}
            className="w-full text-center text-sm font-semibold text-brand hover:text-brand-hover py-2.5 border border-brand/20 rounded-xl hover:bg-brand/5 transition-colors mt-1"
          >
            Stapel verwalten →
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminHubPage() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem('moontalk_admin_secret') || '');
  const [authed, setAuthed] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', person_a_name: '', person_b_name: '' });
  const [creating, setCreating] = useState(false);

  async function login(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await api.listRooms(secret);
      if (data.error) throw new Error(data.error);
      sessionStorage.setItem('moontalk_admin_secret', secret);
      setRooms(data);
      setAuthed(true);
    } catch {
      setError('Falsches Passwort');
    }
  }

  useEffect(() => {
    if (secret) {
      api.listRooms(secret).then(data => {
        if (!data.error) { setRooms(data); setAuthed(true); }
      }).catch(() => {});
    }
  }, []);

  async function createStack(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createRoom(form, secret);
      const data = await api.listRooms(secret);
      setRooms(data);
      setForm({ name: '', person_a_name: '', person_b_name: '' });
      setShowCreate(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <span className="text-3xl">🌙</span>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mt-3">Admin</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Passwort eingeben</p>
          </div>
          <form onSubmit={login} className="space-y-4">
            <input
              type="password"
              autoFocus
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Admin-Passwort"
              className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3.5 text-neutral-900 dark:text-white placeholder-neutral-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            />
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <button
              type="submit"
              className="w-full bg-brand hover:bg-brand-hover text-white font-semibold py-4 rounded-xl text-sm transition-colors"
            >
              Anmelden
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-5 py-12">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-3xl">🌙</span>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mt-3">Admin</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">{rooms.length} Stapel</p>
          </div>
          <button
            onClick={() => setShowCreate(s => !s)}
            className="w-10 h-10 rounded-full bg-brand hover:bg-brand-hover text-white flex items-center justify-center transition-colors"
          >
            {showCreate ? <X size={18} /> : <Plus size={18} />}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={createStack} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 mb-4 space-y-3">
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Neuer Stapel</p>
            {[
              { key: 'name', placeholder: 'Name des Stapels (z.B. Yannick & Lena)' },
              { key: 'person_a_name', placeholder: 'Person A' },
              { key: 'person_b_name', placeholder: 'Person B' },
            ].map(({ key, placeholder }) => (
              <input
                key={key}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                required
                className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-neutral-900 dark:text-white placeholder-neutral-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            ))}
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              {creating ? 'Erstelle...' : 'Erstellen'}
            </button>
          </form>
        )}

        <div className="space-y-3">
          {rooms.map(r => <StackCard key={r.id} room={r} secret={secret} />)}
        </div>
      </div>
    </div>
  );
}
