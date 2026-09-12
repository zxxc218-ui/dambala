'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the browser thinks it has a connection.
 *
 * navigator.onLine only knows whether there is a network attached, not whether
 * the server is reachable through it, so a failed request counts as going
 * offline too — the play screen calls goneOffline() when a draw cannot be sent,
 * and the browser's own 'online' event brings it back.
 */

const CHANGED = 'dambala:connection';
let forcedOffline = false;

function subscribe(onChange: () => void) {
  const wake = () => {
    forcedOffline = false;
    onChange();
  };
  window.addEventListener('online', wake);
  window.addEventListener('offline', onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener('online', wake);
    window.removeEventListener('offline', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

function snapshot() {
  return navigator.onLine && !forcedOffline;
}

/** Called when a request failed for network reasons. */
export function goneOffline() {
  if (forcedOffline) return;
  forcedOffline = true;
  window.dispatchEvent(new Event(CHANGED));
}

/** Called when a request got through again, so the banner clears itself. */
export function backOnline() {
  if (!forcedOffline) return;
  forcedOffline = false;
  window.dispatchEvent(new Event(CHANGED));
}

export default function useOnline(): boolean {
  // the server has no connection state; assume online so the first paint matches
  return useSyncExternalStore(subscribe, snapshot, () => true);
}
