'use client';

import { DEFAULT_PRIZES, PrizeSettings, normalizePrizes } from '@/lib/prizes';

/**
 * The game itself, kept on the device.
 *
 * The hall is the wrong place to depend on a network. A ball comes out of the
 * drum and the caller says the number; the screen must agree with him before he
 * has finished saying it, every time, whether the wifi is up, down or halfway.
 * So the game does not live on the server while it is being played — it lives
 * here, and the server is told the whole story afterwards.
 *
 * Two properties matter more than anything else in this file:
 *
 *   1. A draw is a plain synchronous function call. No promise, no await, no
 *      request. Ninety numbers hammered in as fast as a person can type them
 *      are ninety ordinary function calls, applied one after another in the
 *      order they were made, because that is what JavaScript does with plain
 *      calls. There is no race to lose.
 *
 *   2. Every check that decides whether a draw is allowed — is it in range, is
 *      it already out — is made against the state as it is at that instant,
 *      inside the mutation. Nothing is checked against a copy of the state that
 *      React handed a component one render ago; that copy is what used to let a
 *      fast double-tap put the same ball on the board twice.
 *
 * The state is written to localStorage on every change, so closing the app,
 * losing the battery or reloading the page all pick up exactly where the game
 * was.
 */

const KEY = 'dambala_game';

export type GameStatus = 'active' | 'paused' | 'finished';

export interface DrawnNumber {
  number: number;
  drawOrder: number;
}

export interface LocalGame {
  /** made on this device, so a game can be started with no connection at all */
  localId: string;
  /** the row id on the server, once the game has been uploaded */
  serverId: number | null;
  name: string;
  status: GameStatus;
  prizes: PrizeSettings;
  /**
   * The sets that were sold for this game, or null for the whole booklet.
   *
   * Kept with the game rather than alongside it because it is part of what the
   * game *was*: reopening a finished session has to rank exactly the sets that
   * were in the room that night, not whatever is selected now.
   */
  sets: number[] | null;
  numbers: DrawnNumber[];
  startedAt: number;
  endedAt: number | null;
  /** when the server was last told about this game, as this device sees the clock */
  syncedAt: number | null;
  /** how many numbers the server had at that moment */
  syncedCount: number;
}

/* --------------------------------------------------------------------- */
/* the store                                                             */
/* --------------------------------------------------------------------- */

let state: LocalGame | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function persist() {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // storage full or blocked: the game carries on in memory
  }
}

/**
 * The chosen sets, made safe: whole numbers, no repeats, in order.
 *
 * Anything that is not a usable list — missing, empty, junk — comes back as
 * null, which everywhere downstream means "the whole booklet". A game saved
 * before this feature existed has no such field, and that is exactly the right
 * answer for it.
 */
export function normalizeSets(raw: any): number[] | null {
  if (!Array.isArray(raw)) return null;

  const out = new Set<number>();
  for (const entry of raw) {
    const n = Number(entry);
    if (Number.isInteger(n) && n > 0) out.add(n);
  }

  return out.size === 0 ? null : [...out].sort((a, b) => a - b);
}

/** Anything read back off a device is suspect — a half-written game is worse than none. */
function sanitize(raw: any): LocalGame | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!Array.isArray(raw.numbers)) return null;

  const seen = new Set<number>();
  const numbers: DrawnNumber[] = [];
  for (const entry of raw.numbers) {
    const n = Number(entry?.number);
    if (!Number.isInteger(n) || n < 1 || n > 90 || seen.has(n)) continue;
    seen.add(n);
    numbers.push({ number: n, drawOrder: numbers.length + 1 });
  }

  const status: GameStatus =
    raw.status === 'paused' || raw.status === 'finished' ? raw.status : 'active';

  return {
    localId: String(raw.localId || newLocalId()),
    serverId: Number.isFinite(raw.serverId) ? Number(raw.serverId) : null,
    name: String(raw.name || 'جلسة سحب'),
    status,
    prizes: normalizePrizes(raw.prizes),
    sets: normalizeSets(raw.sets),
    numbers,
    startedAt: Number(raw.startedAt) || Date.now(),
    endedAt: Number.isFinite(raw.endedAt) ? Number(raw.endedAt) : null,
    syncedAt: Number.isFinite(raw.syncedAt) ? Number(raw.syncedAt) : null,
    syncedCount: Number(raw.syncedCount) || 0,
  };
}

function load(): LocalGame | null {
  if (loaded) return state;
  loaded = true;
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? sanitize(JSON.parse(raw)) : null;
  } catch {
    state = null;
  }
  return state;
}

function set(next: LocalGame | null) {
  state = next;
  loaded = true;
  persist();
  emit();
}

/** Apply a change to the running game. Does nothing when there is no game. */
function update(fn: (game: LocalGame) => LocalGame | null): LocalGame | null {
  const current = load();
  if (!current) return null;
  const next = fn(current);
  if (next === current) return current; // the change was a no-op
  set(next);
  return next;
}

function newLocalId() {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* --------------------------------------------------------------------- */
/* reading                                                               */
/* --------------------------------------------------------------------- */

export function getGame(): LocalGame | null {
  return load();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Two tabs of the same app on one device must not drift apart, so a write in
 * one is picked up by the other. `storage` only fires in the *other* tab, which
 * is exactly what is wanted here.
 */
export function watchOtherTabs(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== KEY) return;
    loaded = false;
    load();
    emit();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

/** The game as the server should see it. */
export function syncPayload(game: LocalGame) {
  return {
    serverId: game.serverId,
    localId: game.localId,
    name: game.name,
    prizes: game.prizes,
    sets: game.sets,
    status: game.status,
    numbers: game.numbers.map((n) => n.number),
    startedAt: new Date(game.startedAt).toISOString(),
    endedAt: game.endedAt ? new Date(game.endedAt).toISOString() : null,
  };
}

/** True when the server does not yet have everything this device knows. */
export function needsSync(game: LocalGame | null): boolean {
  if (!game) return false;
  if (game.serverId === null) return true;
  if (game.syncedCount !== game.numbers.length) return true;
  return game.status === 'finished' && game.syncedAt === null;
}

/* --------------------------------------------------------------------- */
/* playing                                                               */
/* --------------------------------------------------------------------- */

export function startGame(
  name: string,
  prizes: PrizeSettings,
  sets?: number[] | null
): LocalGame {
  const game: LocalGame = {
    localId: newLocalId(),
    serverId: null,
    name: name.trim() || `جلسة سحب دمبلة - ${new Date().toLocaleString('ar-EG')}`,
    status: 'active',
    prizes: normalizePrizes(prizes),
    sets: normalizeSets(sets),
    numbers: [],
    startedAt: Date.now(),
    endedAt: null,
    syncedAt: null,
    syncedCount: 0,
  };
  set(game);
  return game;
}

export type DrawResult =
  | { ok: true; number: number; drawOrder: number; game: LocalGame }
  | { ok: false; reason: string };

/**
 * Put a number on the board.
 *
 * Everything that could reject it is decided here, against the board as it
 * stands right now — not against whatever a component last rendered.
 */
export function drawNumber(num: number): DrawResult {
  const game = load();
  if (!game) return { ok: false, reason: 'ماكو جلسة شغالة' };
  if (game.status !== 'active') return { ok: false, reason: 'الجلسة متوقفة — استأنف اللعب أولاً' };
  if (!Number.isInteger(num) || num < 1 || num > 90) {
    return { ok: false, reason: 'يرجى إدخال رقم صحيح بين 1 و 90' };
  }
  if (game.numbers.some((n) => n.number === num)) {
    return { ok: false, reason: 'هذا الرقم مسحوب مسبقاً' };
  }

  const drawOrder = game.numbers.length + 1;
  const next: LocalGame = {
    ...game,
    numbers: [...game.numbers, { number: num, drawOrder }],
  };
  set(next);
  return { ok: true, number: num, drawOrder, game: next };
}

/** A number picked at random from whatever is still in the drum. */
export function drawRandom(): DrawResult {
  const game = load();
  if (!game) return { ok: false, reason: 'ماكو جلسة شغالة' };
  if (game.status !== 'active') return { ok: false, reason: 'الجلسة متوقفة — استأنف اللعب أولاً' };

  const out = new Set(game.numbers.map((n) => n.number));
  const pool: number[] = [];
  for (let i = 1; i <= 90; i++) if (!out.has(i)) pool.push(i);
  if (pool.length === 0) return { ok: false, reason: 'تم سحب جميع الأرقام الـ 90' };

  return drawNumber(pool[Math.floor(Math.random() * pool.length)]);
}

/** Take the last number back off the board. Returns the number that came off. */
export function undoLast(): number | null {
  const game = load();
  if (!game || game.numbers.length === 0) return null;

  const removed = game.numbers[game.numbers.length - 1].number;
  set({
    ...game,
    numbers: game.numbers.slice(0, -1),
  });
  return removed;
}

export function setStatus(status: GameStatus) {
  update((game) =>
    game.status === status
      ? game
      : { ...game, status, endedAt: status === 'finished' ? Date.now() : null }
  );
}

export function setPrizes(prizes: PrizeSettings) {
  update((game) => ({ ...game, prizes: normalizePrizes(prizes) }));
}

export function setName(name: string) {
  update((game) => ({ ...game, name: name.trim() || game.name }));
}

/** Clear the board but keep playing the same game. */
export function resetNumbers() {
  update((game) => ({ ...game, numbers: [], status: 'active', syncedCount: 0 }));
}

export function finishGame(): LocalGame | null {
  return update((game) => ({ ...game, status: 'finished', endedAt: Date.now() }));
}

/** Forget the game entirely — only once the server has it. */
export function clearGame() {
  set(null);
}

/* --------------------------------------------------------------------- */
/* the server                                                            */
/* --------------------------------------------------------------------- */

/**
 * Record that the server now holds this game.
 *
 * `count` is what the server confirmed it stored, not what the board holds now:
 * a number drawn while the upload was in flight must still count as unsent.
 */
export function markSynced(serverId: number, count: number) {
  update((game) => ({
    ...game,
    serverId,
    syncedAt: Date.now(),
    syncedCount: count,
  }));
}

/**
 * Take on a game the server already has — used when this device has no game of
 * its own but the club has one running (started on another device, say).
 */
export function adoptServerSession(session: {
  id: number | string;
  name: string;
  status: string;
  numbers: { number: number; drawOrder: number }[];
  prizes?: PrizeSettings;
  sets?: number[] | null;
  startedAt?: string;
}): LocalGame {
  const numbers = [...(session.numbers || [])]
    .sort((a, b) => a.drawOrder - b.drawOrder)
    .map((n, i) => ({ number: n.number, drawOrder: i + 1 }));

  const serverId = Number(session.id);
  const game: LocalGame = {
    localId: newLocalId(),
    serverId: Number.isFinite(serverId) ? serverId : null,
    name: session.name,
    status: session.status === 'paused' ? 'paused' : 'active',
    prizes: normalizePrizes(session.prizes ?? DEFAULT_PRIZES),
    sets: normalizeSets(session.sets),
    numbers,
    startedAt: session.startedAt ? new Date(session.startedAt).getTime() : Date.now(),
    endedAt: null,
    syncedAt: Date.now(),
    syncedCount: numbers.length,
  };
  set(game);
  return game;
}

/** Testing seam: drop the in-memory copy so the next read comes off storage. */
export function __reload() {
  loaded = false;
  state = null;
}
