'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { LocalGame, getGame, subscribe, watchOtherTabs } from '@/lib/gameStore';

/**
 * The running game, read straight out of the device store.
 *
 * useSyncExternalStore is what keeps this honest: the store is the single copy
 * of the game, React only mirrors it. A draw mutates the store synchronously
 * and the mirror catches up on the next render — so ten fast taps are ten
 * applied draws, never nine with one lost to a stale render.
 *
 * The server snapshot is deliberately null: the page is rendered on the server
 * before any device storage exists, and claiming otherwise is how hydration
 * mismatches start.
 */
export default function useGame(): LocalGame | null {
  const game = useSyncExternalStore(subscribe, getGame, () => null);

  useEffect(() => watchOtherTabs(), []);

  return game;
}
