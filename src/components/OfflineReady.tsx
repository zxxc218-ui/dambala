'use client';

import { useEffect } from 'react';

/**
 * Installs the service worker that lets the game open without a connection.
 *
 * Only in production: in development the worker would sit in front of the dev
 * server's own reloading and make changes look like they are not applying.
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

  return null;
}
