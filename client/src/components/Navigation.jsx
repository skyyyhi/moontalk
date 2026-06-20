import { NavLink } from 'react-router-dom';
import { MessageCircle, Shuffle, Clock, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const tabs = [
  { to: '/questions', icon: MessageCircle, label: 'Fragen' },
  { to: '/draw', icon: Shuffle, label: 'Ziehen' },
  { to: '/history', icon: Clock, label: 'Verlauf' },
];

export default function Navigation() {
  const { dark, toggle } = useTheme();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 safe-bottom z-40">
      <div className="flex items-center max-w-lg mx-auto">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors duration-150 ${
                isActive
                  ? 'text-brand'
                  : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={21} strokeWidth={isActive ? 2 : 1.75} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        <button
          onClick={toggle}
          className="flex-none px-5 py-3 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          aria-label="Theme wechseln"
        >
          {dark ? <Sun size={20} strokeWidth={1.75} /> : <Moon size={20} strokeWidth={1.75} />}
        </button>
      </div>
    </nav>
  );
}
