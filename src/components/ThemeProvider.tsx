'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * The chosen theme.
 *
 * Only the `data-theme` attribute on <html> matters to the CSS — every colour
 * in the app resolves through the ramp defined for that attribute. This file
 * just decides which one is on and remembers it.
 *
 * The choice lives in localStorage, which is an external store, so it is read
 * through useSyncExternalStore rather than copied into state by an effect:
 * the server renders the default, hydration matches it, and React re-renders
 * once with the real value. No flash, no mismatch, no cascading render.
 */

export const THEMES = ['dark', 'light', 'midnight', 'warm'] as const;
export type Theme = (typeof THEMES)[number];
/** what the user picked; 'system' follows the phone's own setting */
export type ThemeChoice = Theme | 'system';

export const THEME_LABELS: Record<ThemeChoice, string> = {
  system: 'حسب النظام',
  dark: 'داكن',
  light: 'فاتح',
  midnight: 'أسود',
  warm: 'دافئ',
};

export const THEME_HINTS: Record<ThemeChoice, string> = {
  system: 'يتبع إعداد تلفونك',
  dark: 'الوضع الأصلي',
  light: 'للنهار والإضاءة القوية',
  midnight: 'أسود كامل — يوفّر بطارية شاشات AMOLED',
  warm: 'ألوان دافئة أريح للعين بالليل',
};

export const STORAGE_KEY = 'dambala_theme';

/**
 * Runs before the first paint, so the page never renders in one theme and then
 * snaps to another. Kept as a string because it has to be inlined in <head>.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var c=localStorage.getItem('${STORAGE_KEY}')||'system';
var t=c==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):c;
document.documentElement.setAttribute('data-theme',t);
}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

const CHANGED_EVENT = 'dambala:theme';

function isChoice(v: unknown): v is ThemeChoice {
  return v === 'system' || (typeof v === 'string' && (THEMES as readonly string[]).includes(v));
}

function readChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isChoice(raw) ? raw : 'system';
  } catch {
    // private mode, or storage blocked
    return 'system';
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED_EVENT, onChange);
  // another tab of the same game
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGED_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** What is actually painted for a given choice. */
export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice !== 'system') return choice;
  if (typeof window === 'undefined') return 'dark';
  return systemTheme();
}

export function useTheme() {
  const choice = useSyncExternalStore(subscribe, readChoice, () => 'system' as ThemeChoice);

  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // it just will not be remembered next time
    }
    document.documentElement.setAttribute('data-theme', resolveTheme(next));
    window.dispatchEvent(new Event(CHANGED_EVENT));
  }, []);

  return { choice, setChoice };
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { choice } = useTheme();

  useEffect(() => {
    // The first render after hydration still reports the server's 'system',
    // so this must re-apply the real choice once the store has been read —
    // otherwise a saved theme is quietly replaced by the system one.
    const paint = () => {
      document.documentElement.setAttribute('data-theme', resolveTheme(choice));
    };
    paint();

    // Following the system means following it as it changes, not only at load.
    if (choice !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', paint);
    return () => mq.removeEventListener('change', paint);
  }, [choice]);

  return <>{children}</>;
}
