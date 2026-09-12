'use client';

/**
 * Playing through a dead connection.
 *
 * A hall's wifi drops mid-game and the caller cannot stop. So a drawn number is
 * never allowed to depend on the network: it goes on the screen immediately, is
 * written to this device, and — if the request could not be sent — waits in an
 * outbox until the connection returns.
 *
 * The server stays the source of truth. The outbox only replays what this
 * device did while it could not be heard; once it drains, the board is re-read
 * from the server and this file's copy is overwritten.
 */

const OUTBOX_KEY = 'dambala_outbox';
const BOARD_KEY = 'dambala_board';

export type PendingKind = 'draw' | 'undo';

export interface PendingOp {
  id: string;
  kind: PendingKind;
  number: number;
  /** which game it belonged to, so a stale queue is never replayed into a new one */
  sessionId: string;
  at: number;
}

/** The board as this device last saw it, so a reload offline still shows the game. */
export interface BoardSnapshot {
  sessionId: string;
  name: string;
  status: string;
  numbers: { number: number; drawOrder: number }[];
  savedAt: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // private mode, blocked storage, or something else wrote junk here
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // out of quota or blocked — the game must still run
  }
}

/* ----------------------------- the outbox ----------------------------- */

export function pendingOps(): PendingOp[] {
  return read<PendingOp[]>(OUTBOX_KEY, []);
}

export function queueOp(kind: PendingKind, number: number, sessionId: string): PendingOp {
  const op: PendingOp = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    number,
    sessionId,
    at: Date.now(),
  };
  write(OUTBOX_KEY, [...pendingOps(), op]);
  return op;
}

/**
 * An undo cancels a draw that never left this device — there is nothing for the
 * server to undo, so both disappear instead of being replayed as a pair.
 */
export function queueUndo(number: number, sessionId: string) {
  const ops = pendingOps();
  const i = ops.findIndex((o) => o.kind === 'draw' && o.number === number && o.sessionId === sessionId);
  if (i !== -1) {
    ops.splice(i, 1);
    write(OUTBOX_KEY, ops);
    return;
  }
  queueOp('undo', number, sessionId);
}

export function clearOps(ids: string[]) {
  const keep = pendingOps().filter((o) => !ids.includes(o.id));
  write(OUTBOX_KEY, keep);
}

export function dropOpsForOtherSessions(sessionId: string | null) {
  if (!sessionId) return;
  const keep = pendingOps().filter((o) => o.sessionId === sessionId);
  write(OUTBOX_KEY, keep);
}

/**
 * Send everything waiting, oldest first.
 *
 * Replaying a draw the server already has, or undoing one it never had, is not
 * a failure — it means the request did arrive after all, so the op is dropped.
 * Anything that fails for a network reason is left in the queue for next time.
 */
export async function flushOutbox(): Promise<{ sent: number; left: number }> {
  const ops = pendingOps();
  if (ops.length === 0) return { sent: 0, left: 0 };

  const done: string[] = [];

  for (const op of ops) {
    try {
      const res = await fetch('/api/sessions/current/draw', {
        method: op.kind === 'draw' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: op.number }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success) {
        done.push(op.id);
        continue;
      }

      // the server has a firm opinion — replaying will not change it
      const message = String(data?.message || '');
      const alreadyThere = /مسحوب مسبقاً/.test(message);
      const notThere = /غير موجود/.test(message);
      if (res.status === 400 && (alreadyThere || notThere)) {
        done.push(op.id);
        continue;
      }
      if (res.status >= 400 && res.status < 500) {
        done.push(op.id); // a bad request will never succeed; do not block the queue
        continue;
      }

      break; // server trouble — keep the rest for later
    } catch {
      break; // still offline
    }
  }

  clearOps(done);
  return { sent: done.length, left: pendingOps().length };
}

/* --------------------------- the board copy --------------------------- */

export function saveBoard(snapshot: BoardSnapshot) {
  write(BOARD_KEY, snapshot);
}

export function loadBoard(): BoardSnapshot | null {
  return read<BoardSnapshot | null>(BOARD_KEY, null);
}

export function clearBoard() {
  try {
    localStorage.removeItem(BOARD_KEY);
  } catch {
    // nothing to do
  }
}

/** A failed fetch means the network, not the server saying no. */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || !navigator.onLine;
}
