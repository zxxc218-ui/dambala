import { CardIndex, IndexedCard, WinType, WIN_LABELS } from '@/lib/cards';

/**
 * Prize rules for one game.
 *
 * Each prize can be switched off, and the line prizes carry a count: how many
 * cards are allowed to win that line before it closes. الزوايا is deliberately
 * outside the counting — if a card's four corners come up it wins, full stop.
 *
 * Nothing about who has won is stored. The standings are worked out from the
 * numbers drawn so far, so undoing a number takes its win back with it.
 */

export type PrizeKey = WinType;

export interface PrizeRule {
  enabled: boolean;
  /** how many cards may win it; ignored for the unlimited prizes */
  count: number;
}

export type PrizeSettings = Record<PrizeKey, PrizeRule>;

/** Prizes that are never capped — they pay out every time they appear. */
export const UNLIMITED_PRIZES: PrizeKey[] = ['corners'];

export const PRIZE_ORDER: PrizeKey[] = ['row1', 'row2', 'row3', 'corners', 'fullCard'];

export const PRIZE_LABELS = WIN_LABELS;

export const MAX_PRIZE_COUNT = 99;

export const DEFAULT_PRIZES: PrizeSettings = {
  row1: { enabled: true, count: 1 },
  row2: { enabled: true, count: 1 },
  row3: { enabled: true, count: 1 },
  corners: { enabled: true, count: 0 },
  fullCard: { enabled: true, count: 1 },
};

export function isUnlimited(key: PrizeKey): boolean {
  return UNLIMITED_PRIZES.includes(key);
}

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
      count: isUnlimited(key)
        ? 0
        : !isFinite(count) || count < 1
        ? fallback.count
        : Math.min(Math.floor(count), MAX_PRIZE_COUNT),
    };
  }

  return out;
}

/** The numbers that make up one prize on one card. */
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
  }
}

export interface PrizeWinner {
  setNo: number;
  cardNo: number;
  /** the draw order of the number that completed it */
  at: number;
}

export interface PrizeStanding {
  key: PrizeKey;
  label: string;
  enabled: boolean;
  unlimited: boolean;
  /** 0 when unlimited */
  count: number;
  /** cards that actually take the prize, earliest first */
  winners: PrizeWinner[];
  /** cards that completed the line after the prize was already full */
  late: PrizeWinner[];
  /** no places left */
  closed: boolean;
}

export type PrizeStandings = Record<PrizeKey, PrizeStanding>;

/**
 * Work out who holds each prize.
 *
 * A card completes a prize on the highest draw order among that prize's
 * numbers. Cards are ranked by that moment; places are handed out in order
 * until the prize's count runs out. Cards that completed on the very same
 * number share the place — they called it at the same instant, so they all win.
 */
export function computeStandings(
  index: CardIndex,
  orderOf: Map<number, number>,
  settings: PrizeSettings
): PrizeStandings {
  const standings = {} as PrizeStandings;

  for (const key of PRIZE_ORDER) {
    const rule = settings[key];
    const unlimited = isUnlimited(key);

    const completed: PrizeWinner[] = [];

    if (rule.enabled) {
      for (const card of index.cards) {
        const values = valuesForPrize(card, key);
        if (values.length === 0) continue;

        let at = 0;
        let whole = true;
        for (const v of values) {
          const order = orderOf.get(v);
          if (order === undefined) {
            whole = false;
            break;
          }
          if (order > at) at = order;
        }

        if (whole) completed.push({ setNo: card.setNo, cardNo: card.cardNo, at });
      }

      completed.sort((a, b) =>
        a.at !== b.at ? a.at - b.at : a.setNo !== b.setNo ? a.setNo - b.setNo : a.cardNo - b.cardNo
      );
    }

    const winners: PrizeWinner[] = [];
    const late: PrizeWinner[] = [];

    if (unlimited) {
      winners.push(...completed);
    } else {
      let i = 0;
      while (i < completed.length) {
        // everyone who finished on this same number
        let j = i;
        while (j < completed.length && completed[j].at === completed[i].at) j++;

        if (winners.length < rule.count) {
          winners.push(...completed.slice(i, j));
        } else {
          late.push(...completed.slice(i, j));
        }
        i = j;
      }
    }

    standings[key] = {
      key,
      label: PRIZE_LABELS[key],
      enabled: rule.enabled,
      unlimited,
      count: unlimited ? 0 : rule.count,
      winners,
      late,
      closed: rule.enabled && !unlimited && winners.length >= rule.count,
    };
  }

  return standings;
}

/** The small summary the play screen shows as a live counter row. */
export interface PrizeStatus {
  key: PrizeKey;
  label: string;
  enabled: boolean;
  unlimited: boolean;
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
      unlimited: s.unlimited,
      count: s.count,
      won: s.winners.length,
      closed: s.closed,
    };
  });
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
