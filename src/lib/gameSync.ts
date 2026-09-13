'use client';

import {
  LocalGame,
  finishGame,
  getGame,
  markSynced,
  clearGame,
  syncPayload,
} from '@/lib/gameStore';

/**
 * Telling the server what happened, once it no longer matters how long it takes.
 *
 * Nothing here runs while a game is being played. A finished game is moved into
 * a queue on the device and uploaded from there, so the caller can start the
 * next game immediately without waiting for the last one to go up, and a failed
 * upload costs nothing but a retry later.
 */

const QUEUE_KEY = 'dambala_pending_games';

export interface PendingGame {
  localId: string;
  serverId: number | null;
  name: string;
  prizes: any;
  status: string;
  numbers: number[];
  startedAt: string;
  endedAt: string | null;
  /** so a game that keeps failing can be explained rather than silently stuck */
  attempts: number;
  lastError?: string;
}

function readQueue(): PendingGame[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeQueue(list: PendingGame[]) {
  try {
    if (list.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch {
    // nothing sensible to do; the running game is unaffected
  }
}

export function pendingGames(): PendingGame[] {
  return readQueue();
}

export function pendingCount(): number {
  return readQueue().length;
}

/** Numbers still waiting to reach the server, across every queued game. */
export function pendingNumbers(): number {
  return readQueue().reduce((sum, g) => sum + g.numbers.length, 0);
}

/* --------------------------------------------------------------------- */

async function upload(payload: PendingGame | ReturnType<typeof syncPayload>) {
  const res = await fetch('/api/sessions/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || `فشل الرفع (${res.status})`);
  }
  return data as { serverId: number; count: number; prizesStored?: boolean };
}

/**
 * End the game and hand it to the queue.
 *
 * The queue write happens before the game is cleared, so a crash in between
 * leaves a duplicate to upload rather than a game that was never recorded.
 */
export function archiveCurrentGame(): PendingGame | null {
  const finished = finishGame();
  if (!finished) return null;

  const entry: PendingGame = { ...syncPayload(finished), attempts: 0 };
  writeQueue([...readQueue(), entry]);
  clearGame();
  return entry;
}

let flushing = false;

/**
 * Send every queued game, oldest first.
 *
 * A game that uploads is dropped from the queue. A game the server rejects
 * outright is dropped too — retrying a request the server has already refused
 * on its merits would block every game behind it forever — but the reason is
 * kept so it can be shown. Anything that fails for a network reason stays.
 */
export async function flushPendingGames(): Promise<{ sent: number; left: number; error?: string }> {
  if (flushing) return { sent: 0, left: pendingCount() };
  flushing = true;

  let sent = 0;
  let error: string | undefined;

  try {
    // re-read between uploads: finishing another game mid-flush must not be lost
    for (;;) {
      const queue = readQueue();
      if (queue.length === 0) break;

      const [head, ...rest] = queue;
      try {
        const result = await upload(head);
        // keep the server id in case this same game is queued again
        writeQueue(rest.map((g) => (g.localId === head.localId ? { ...g, serverId: result.serverId } : g)));
        sent++;
      } catch (err: any) {
        const message = String(err?.message || err);
        const networkDown = err instanceof TypeError || !navigator.onLine;

        if (networkDown) {
          error = 'ماكو اتصال';
          break;
        }

        // The server answered and said no. Try twice more in case it was a
        // passing failure, then set it aside rather than blocking the queue.
        const attempts = head.attempts + 1;
        if (attempts >= 3) {
          writeQueue(rest);
          error = message;
          continue;
        }

        writeQueue([{ ...head, attempts, lastError: message }, ...rest]);
        error = message;
        break;
      }
    }
  } finally {
    flushing = false;
  }

  return { sent, left: pendingCount(), error };
}

/**
 * Push the game that is running right now, without ending it.
 *
 * Not part of playing — it is the button for a caller who wants the numbers
 * safe on the server before the game is over.
 */
export async function syncRunningGame(): Promise<{ ok: boolean; message: string }> {
  const game: LocalGame | null = getGame();
  if (!game) return { ok: false, message: 'ماكو جلسة' };

  try {
    const countAtSend = game.numbers.length;
    const result = await upload(syncPayload(game));
    markSynced(result.serverId, Math.min(result.count, countAtSend));
    return { ok: true, message: `انرفعت ${result.count} رقم للسيرفر` };
  } catch (err: any) {
    const networkDown = err instanceof TypeError || !navigator.onLine;
    return {
      ok: false,
      message: networkDown ? 'ماكو اتصال — الأرقام محفوظة بالجهاز' : String(err?.message || err),
    };
  }
}
