'use client';

import { Check, Monitor, Moon, MoonStar, Sun, Flame } from 'lucide-react';
import {
  THEMES,
  THEME_HINTS,
  THEME_LABELS,
  ThemeChoice,
  useTheme,
} from '@/components/ThemeProvider';

/** A swatch showing what each theme actually looks like, not just its name. */
const SWATCH: Record<ThemeChoice, { page: string; card: string; ink: string }> = {
  system: { page: '#020617', card: '#ffffff', ink: '#10b981' },
  dark: { page: '#020617', card: '#0f172a', ink: '#10b981' },
  light: { page: '#eef2f7', card: '#ffffff', ink: '#10b981' },
  midnight: { page: '#000000', card: '#0d0d0f', ink: '#10b981' },
  warm: { page: '#0c0a09', card: '#1c1917', ink: '#10b981' },
};

const ICON: Record<ThemeChoice, typeof Sun> = {
  system: Monitor,
  dark: Moon,
  light: Sun,
  midnight: MoonStar,
  warm: Flame,
};

const OPTIONS: ThemeChoice[] = ['system', ...THEMES];

export default function ThemeSwitcher() {
  const { choice, setChoice } = useTheme();

  return (
    <div className="flex flex-col gap-1.5">
      {OPTIONS.map((option) => {
        const Icon = ICON[option];
        const swatch = SWATCH[option];
        const picked = choice === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => setChoice(option)}
            aria-pressed={picked}
            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors cursor-pointer text-right ${
              picked
                ? 'bg-emerald-500/10 border-emerald-500/40'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            {/* a miniature of the page itself */}
            <span
              className="w-9 h-9 rounded-lg flex-shrink-0 border border-slate-700/60 flex items-end justify-start p-1 overflow-hidden"
              style={{ background: swatch.page }}
              aria-hidden
            >
              <span
                className="w-full h-4 rounded-[3px] flex items-center justify-end px-1"
                style={{ background: swatch.card }}
              >
                <span
                  className="w-2 h-2 rounded-full block"
                  style={{ background: swatch.ink }}
                />
              </span>
            </span>

            <span className="min-w-0 flex-1">
              <span
                className="flex items-center gap-1.5 text-xs font-black text-slate-100"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <Icon size={13} className={picked ? 'text-emerald-400' : 'text-slate-400'} />
                {THEME_LABELS[option]}
              </span>
              <span
                className="block text-[9px] text-slate-400 mt-0.5 truncate"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {THEME_HINTS[option]}
              </span>
            </span>

            {picked && <Check size={16} className="text-emerald-400 flex-shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
