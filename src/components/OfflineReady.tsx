'use client';

import { useEffect } from 'react';
import { ensureLocalCards } from '@/lib/localCards';

/**
 * Everything the app needs before the connection goes away.
 *
 * Two things, both quiet and both on every page: the service worker that lets
 * the pages open with no network, and the copy of the cards that lets them show
 * anything once they do. Both are one-time — after the first visit they cost a
 * revalidation, and they are what turn this from a website into something that
 * still works in a hall with no signal.
 */
export default function OfflineReady() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // an unsupported or blocked worker only costs the offline fallback
      });
    };

    // registering during load competes with the page's own requests
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  /**
   * The cards, fetched once and kept. Failing is fine — it only means the
   * device is not ready for an outage yet, and the next online visit retries.
   */
  useEffect(() => {
    const idle = () => {
      void ensureLocalCards();
    };
    const w = window as any;
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(idle, { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(idle, 1500);
    return () => clearTimeout(t);
  }, []);

  return null;
}
