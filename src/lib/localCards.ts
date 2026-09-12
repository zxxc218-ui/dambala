'use client';

import { CardIndex, buildIndex, makeCard } from '@/lib/cardShape';

/**
 * A copy of the cards kept on the device, so winners can still be named when
 * the connection is gone.
 *
 * It is downloaded quietly while the game is online and reused from then on.
 * The sets change only when someone edits them, so a stale copy is refreshed in
 * the background rather than blocking the game on a download.
 */

const KEY = 'dambala_cards';
/** refresh in the background once a copy is older than this */
const STALE_MS = 24 * 60 * 60 * 1000;

interface Stored {
  version: number;
  savedAt: number;
  /** [setNo, cardNo, ...row1, -1, ...row2, -1, ...row3] per card */
  cards: number[][];
}

let memo: CardIndex | null = null;

function decode(packed: number[][]): CardIndex {
  return buildIndex(
    packed.map((entry) => {
      const setNo = entry[0];
      const cardNo = entry[1];
      const rows: number[][] = [[], [], []];
      let r = 0;
      for (let i = 2; i < entry.length; i++) {
        if (entry[i] === -1) r++;
        else rows[r]?.push(entry[i]);
      }
      return makeCard(setNo, cardNo, rows);
    })
  );
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

/** The cards this device already has, or null if it has never downloaded them. */
export function localCardIndex(): CardIndex | null {
  if (memo) return memo;
  const stored = readStored();
  if (!stored?.cards?.length) return null;
  try {
    memo = decode(stored.cards);
    return memo;
  } catch {
    return null;
  }
}

export function hasLocalCards(): boolean {
  return localCardIndex() !== null;
}

/**
 * Fetch the cards if this device has none, or if the copy has gone stale.
 * Failing is fine — it just means offline winner checks wait for the next time
 * there is a connection.
 */
export async function ensureLocalCards(): Promise<CardIndex | null> {
  const stored = readStored();
  const fresh = stored && Date.now() - stored.savedAt < STALE_MS;
  if (stored?.cards?.length && fresh) return localCardIndex();

  try {
    const res = await fetch('/api/sets/index');
    if (!res.ok) return localCardIndex();
    const data = await res.json();
    if (!data?.success || !Array.isArray(data.cards) || data.cards.length === 0) {
      return localCardIndex();
    }

    const next: Stored = { version: data.version ?? 0, savedAt: Date.now(), cards: data.cards };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // no room; the in-memory copy still serves this session
    }
    memo = decode(next.cards);
    return memo;
  } catch {
    return localCardIndex();
  }
}
