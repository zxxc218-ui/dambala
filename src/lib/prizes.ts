import { CardIndex, HalfKey, IndexedCard, WinType, WIN_LABELS } from '@/lib/cardShape';

/**
 * Prize rules for one game.
 *
 * Every prize can be switched off and carries a count: how many may win it
 * before it closes.
 *
 * A prize is not always won by a card. The sheet a hall plays on says so along
 * its head — الزوايا · السيت · نصف السيت · بطاقة — because the corners can be
 * claimed at three sizes: the four corners of one card, of one column of three
 * (half the set), or of the whole printed page. So a prize here names what can
 * win it, and one ranking rule covers all three.
 *
 * Nothing about who has won is stored. The standings are worked out from the
 * numbers drawn so far, so undoing a number takes its win back with it.
 */

export type PrizeKey = WinType | 'halfSetCorners' | 'setCorners';

export interface PrizeRule {
  enabled: boolean;
  /** how many may win it before it closes */
  count: number;
}

export type PrizeSettings = Record<PrizeKey, PrizeRule>;

export const PRIZE_ORDER: PrizeKey[] = [
  'row1',
  'row2',
  'row3',
  'corners',
  'halfSetCorners',
  'setCorners',
  'fullCard',
];

export const PRIZE_LABELS: Record<PrizeKey, string> = {
  ...WIN_LABELS,
  corners: 'زوايا البطاقة',
  halfSetCorners: 'زوايا نصف السيت',
  setCorners: 'زوايا السيت',
};

/** What can win a prize: one card, one column of a set, or the whole set. */
export type PrizeScope = 'card' | 'half' | 'set';

export const PRIZE_SCOPE: Record<PrizeKey, PrizeScope> = {
  row1: 'card',
  row2: 'card',
  row3: 'card',
  corners: 'card',
  fullCard: 'card',
  halfSetCorners: 'half',
  setCorners: 'set',
};

export const HALF_LABELS: Record<HalfKey, string> = {
  left: 'النصف اليسار',
  right: 'النصف اليمين',
};

export const MAX_PRIZE_COUNT = 99;

export const DEFAULT_PRIZES: PrizeSettings = {
  row1: { enabled: true, count: 1 },
  row2: { enabled: true, count: 1 },
  row3: { enabled: true, count: 1 },
  corners: { enabled: true, count: 1 },
  halfSetCorners: { enabled: true, count: 1 },
  setCorners: { enabled: true, count: 1 },
  fullCard: { enabled: true, count: 1 },
};

/** Accept whatever came off the wire (or out of an old row) and make it safe. */
export function normalizePrizes(raw: any): PrizeSettings {
  const out = {} as PrizeSettings;

  for (const key of PRIZE_ORDER) {
    const fallback = DEFAULT_PRIZES[key];
    const given = raw && typeof raw === 'object' ? raw[key] : null;

    if (!given || typeof given !== 'object') {
      out[key] = { ...fallback };
      continue;
    }

    const count = Number(given.count);
    out[key] = {
      enabled: given.enabled === undefined ? fallback.enabled : Boolean(given.enabled),
      count:
        !isFinite(count) || count < 1
          ? fallback.count
          : Math.min(Math.floor(count), MAX_PRIZE_COUNT),
    };
  }

  return out;
}

/** The numbers that make up one card-sized prize on one card. */
export function valuesForPrize(card: IndexedCard, key: PrizeKey): number[] {
  switch (key) {
    case 'row1':
      return card.rows[0];
    case 'row2':
      return card.rows[1];
    case 'row3':
      return card.rows[2];
    case 'corners':
      return card.corners;
    case 'fullCard':
      return card.all;
    default:
      return [];
  }
}

/**
 * Everything that can win a given prize, with the numbers it needs.
 *
 * This is the one place the three sizes differ. Past it, a prize is just a list
 * of contenders and the numbers each of them is waiting on, and the ranking
 * below neither knows nor cares whether a contender is a card, a column or a
 * whole page.
 */
export interface Entrant {
  setNo: number;
  /** set when a single card is what wins */
  cardNo?: number;
  /** set when one column of the set is what wins */
  half?: HalfKey;
  values: number[];
}

export function entrantsFor(index: CardIndex, key: PrizeKey): Entrant[] {
  switch (PRIZE_SCOPE[key]) {
    case 'card':
      return index.cards.map((card) => ({
        setNo: card.setNo,
        cardNo: card.cardNo,
        values: valuesForPrize(card, key),
      }));

    case 'half':
      return index.sets.flatMap((group) =>
        group.halves.map((half) => ({
          setNo: group.setNo,
          half: half.key,
          values: half.corners,
        }))
      );

    case 'set':
      return index.sets.map((group) => ({ setNo: group.setNo, values: group.corners }));
  }
}

export interface PrizeWinner {
  setNo: number;
  cardNo?: number;
  half?: HalfKey;
  /** the draw order of the number that completed it */
  at: number;
}

export interface PrizeStanding {
  key: PrizeKey;
  label: string;
  scope: PrizeScope;
  enabled: boolean;
  count: number;
  /** those that actually take the prize, earliest first */
  winners: PrizeWinner[];
  /** those that completed it after the prize was already full */
  late: PrizeWinner[];
  /** no places left */
  closed: boolean;
}

export type PrizeStandings = Record<PrizeKey, PrizeStanding>;

/** A stable order for contenders that finished on the very same number. */
function tieBreak(a: PrizeWinner, b: PrizeWinner): number {
  if (a.setNo !== b.setNo) return a.setNo - b.setNo;
  if ((a.cardNo ?? 0) !== (b.cardNo ?? 0)) return (a.cardNo ?? 0) - (b.cardNo ?? 0);
  return (a.half ?? '').localeCompare(b.half ?? '');
}

/**
 * Work out who holds each prize.
 *
 * A contender completes a prize on the highest draw order among that prize's
 * numbers. They are ranked by that moment; places are handed out in order until
 * the prize's count runs out. Those that completed on the very same number
 * share the place — they called it at the same instant, so they all win.
 */
export function computeStandings(
  index: CardIndex,
  orderOf: Map<number, number>,
  settings: PrizeSettings
): PrizeStandings {
  const standings = {} as PrizeStandings;

  for (const key of PRIZE_ORDER) {
    const rule = settings[key];
    const completed: PrizeWinner[] = [];

    if (rule.enabled) {
      for (const entrant of entrantsFor(index, key)) {
        if (entrant.values.length === 0) continue;

        let at = 0;
        let whole = true;
        for (const v of entrant.values) {
          const order = orderOf.get(v);
          if (order === undefined) {
            whole = false;
            break;
          }
          if (order > at) at = order;
        }

        if (whole) {
          completed.push({ setNo: entrant.setNo, cardNo: entrant.cardNo, half: entrant.half, at });
        }
      }

      completed.sort((a, b) => (a.at !== b.at ? a.at - b.at : tieBreak(a, b)));
    }

    const winners: PrizeWinner[] = [];
    const late: PrizeWinner[] = [];

    let i = 0;
    while (i < completed.length) {
      // everyone who finished on this same number
      let j = i;
      while (j < completed.length && completed[j].at === completed[i].at) j++;

      if (winners.length < rule.count) winners.push(...completed.slice(i, j));
      else late.push(...completed.slice(i, j));

      i = j;
    }

    standings[key] = {
      key,
      label: PRIZE_LABELS[key],
      scope: PRIZE_SCOPE[key],
      enabled: rule.enabled,
      count: rule.count,
      winners,
      late,
      closed: rule.enabled && winners.length >= rule.count,
    };
  }

  return standings;
}

/** One prize just taken, ready to be announced. */
export interface FreshWin extends PrizeWinner {
  key: PrizeKey;
  label: string;
  scope: PrizeScope;
  /** which place it took in that prize (1 = first) */
  place: number;
  count: number;
}

/**
 * What the ball that just came out won.
 *
 * A prize taken by that ball is simply one whose winner completed on its draw
 * order — there is nothing else to look for, and reading it out of the
 * standings rather than recomputing it is what keeps the announcement and the
 * counters from ever disagreeing.
 */
export function freshWins(standings: PrizeStandings, justDrawnOrder: number | undefined): FreshWin[] {
  if (justDrawnOrder === undefined) return [];

  const out: FreshWin[] = [];
  for (const key of PRIZE_ORDER) {
    const standing = standings[key];
    if (!standing.enabled) continue;

    standing.winners.forEach((w, i) => {
      if (w.at !== justDrawnOrder) return;
      out.push({
        ...w,
        key,
        label: standing.label,
        scope: standing.scope,
        place: i + 1,
        count: standing.count,
      });
    });
  }
  return out;
}

/** The small summary the play screen shows as a live counter row. */
export interface PrizeStatus {
  key: PrizeKey;
  label: string;
  enabled: boolean;
  count: number;
  won: number;
  closed: boolean;
}

export function toStatus(standings: PrizeStandings): PrizeStatus[] {
  return PRIZE_ORDER.map((key) => {
    const s = standings[key];
    return {
      key,
      label: s.label,
      enabled: s.enabled,
      count: s.count,
      won: s.winners.length,
      closed: s.closed,
    };
  });
}

/**
 * What to draw to show a win, and which numbers make it up.
 *
 * A win is easiest to believe when you can see it, and what "it" is depends on
 * the size of the prize: one card, one column of three, or the whole printed
 * page. This returns the cards laid out in the columns they are printed in,
 * plus the numbers that had to come out — so a single component can draw all
 * three and a caller can check any of them against the paper in someone's hand.
 */
export interface WinPicture {
  /** cards in printed column order — one column, or the two of a full page */
  columns: IndexedCard[][];
  /** the numbers the prize is made of */
  highlight: number[];
}

export function winPicture(
  index: CardIndex,
  w: { key: PrizeKey; setNo: number; cardNo?: number; half?: HalfKey }
): WinPicture | null {
  const scope = PRIZE_SCOPE[w.key];

  if (scope === 'card') {
    const card = index.cards.find((c) => c.setNo === w.setNo && c.cardNo === w.cardNo);
    if (!card) return null;
    return { columns: [[card]], highlight: valuesForPrize(card, w.key) };
  }

  const group = index.sets.find((g) => g.setNo === w.setNo);
  if (!group) return null;

  if (scope === 'half') {
    const half = group.halves.find((h) => h.key === w.half);
    if (!half) return null;
    return { columns: [half.cards], highlight: half.corners };
  }

  return {
    columns: group.halves.map((h) => h.cards),
    highlight: group.corners,
  };
}

/** How a winner is named: a card, a column of a set, or the set itself. */
export function winnerName(w: PrizeWinner): string {
  const set = `سيت ${String(w.setNo).padStart(3, '0')}`;
  if (w.cardNo !== undefined) return `${set} | بطاقة ${String(w.cardNo).padStart(2, '0')}`;
  if (w.half) return `${set} — ${HALF_LABELS[w.half]}`;
  return `${set} — السيت كله`;
}

/** Draw order of every number drawn so far. */
export function orderMap(rows: { number: number; draw_order: number }[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.number, r.draw_order);
  return map;
}

/**
 * Supabase's reply when `draw_sessions.prizes` has not been added yet.
 * Until the owner runs db/prizes.sql the app keeps working on the defaults
 * rather than refusing to start a game.
 */
export function isMissingPrizesColumn(error: any): boolean {
  if (!error) return false;
  const code = error.code;
  const message = String(error.message || '');
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    (/prizes/i.test(message) && /(column|schema cache)/i.test(message))
  );
}

/* --------------------------------------------------------------------------
   Which sets a game was played on, carried with its rules.

   A game played on part of the booklet has to be reopened on that same part,
   or its winners change when someone views it later. That belongs in the
   database next to the rules — but rather than a second column the owner has
   to go and add, it rides inside the `prizes` blob: `sets` is not a prize key,
   so it cannot collide with one, and normalizePrizes builds its result from
   PRIZE_ORDER alone and quietly drops it.
   -------------------------------------------------------------------------- */

/** The rules plus the sets, as one value to store. */
export function packRules(prizes: PrizeSettings, sets: number[] | null | undefined) {
  const clean = readSets(sets);
  return clean ? { ...prizes, sets: clean } : { ...prizes };
}

/** The sets out of a stored blob, or null for the whole booklet. */
export function readSets(raw: any): number[] | null {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.sets) ? raw.sets : null;
  if (!list) return null;

  const out = new Set<number>();
  for (const entry of list) {
    const n = Number(entry);
    if (Number.isInteger(n) && n > 0) out.add(n);
  }

  return out.size === 0 ? null : [...out].sort((a, b) => a - b);
}
