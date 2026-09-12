/**
 * What a card is, and what counts as a win on it.
 *
 * Deliberately free of any database import, so the browser can run exactly the
 * same rules the server does. That is what lets the game keep naming winners
 * when the connection is gone — the alternative would be a second, slightly
 * different implementation on the client, which is how two screens end up
 * disagreeing about who won.
 */

export interface IndexedCard {
  setNo: number;
  cardNo: number;
  /** the 5 numbers of each row, rows 1..3 */
  rows: number[][];
  /** all 15 numbers of the card */
  all: number[];
  /** the 4 corners: first and last number of row 1, first and last of row 3 */
  corners: number[];
}

export interface CardIndex {
  cards: IndexedCard[];
  /** number (1..90) -> indexes into `cards` of every card holding it */
  byNumber: Map<number, number[]>;
  builtAt: number;
}

export type WinType = 'row1' | 'row2' | 'row3' | 'corners' | 'fullCard';

export const WIN_LABELS: Record<WinType, string> = {
  row1: 'الخط الأول',
  row2: 'الخط الثاني',
  row3: 'الخط الثالث',
  corners: 'الزوايا',
  fullCard: 'البطاقة كاملة (دمبلة)',
};

/** Build a card from its three rows, working out the corners and the full set. */
export function makeCard(setNo: number, cardNo: number, rows: number[][]): IndexedCard {
  const safeRows = [0, 1, 2].map((i) => rows[i] ?? []);
  const all = safeRows.flat();

  const corners: number[] = [];
  const top = safeRows[0];
  const bottom = safeRows[2];
  if (top.length > 0) corners.push(top[0], top[top.length - 1]);
  if (bottom.length > 0) corners.push(bottom[0], bottom[bottom.length - 1]);

  return { setNo, cardNo, rows: safeRows, all, corners };
}

/** Sort the cards and index them by number, so a draw only scans what it must. */
export function buildIndex(cards: IndexedCard[]): CardIndex {
  const sorted = [...cards].sort((a, b) =>
    a.setNo !== b.setNo ? a.setNo - b.setNo : a.cardNo - b.cardNo
  );

  const byNumber = new Map<number, number[]>();
  sorted.forEach((card, idx) => {
    for (const n of card.all) {
      const list = byNumber.get(n);
      if (list) list.push(idx);
      else byNumber.set(n, [idx]);
    }
  });

  return { cards: sorted, byNumber, builtAt: Date.now() };
}

function isComplete(values: number[], drawn: Set<number>): boolean {
  return values.length > 0 && values.every((v) => drawn.has(v));
}

/** Every win a card currently holds, given the numbers drawn so far. */
export function winsForCard(card: IndexedCard, drawn: Set<number>): Record<WinType, boolean> {
  return {
    row1: isComplete(card.rows[0], drawn),
    row2: isComplete(card.rows[1], drawn),
    row3: isComplete(card.rows[2], drawn),
    corners: isComplete(card.corners, drawn),
    fullCard: isComplete(card.all, drawn),
  };
}

/**
 * Wins completed *by* `newNumber` — the win must include that number and every
 * other number in it must already be drawn.
 */
export function winsCompletedBy(
  card: IndexedCard,
  newNumber: number,
  drawnBefore: Set<number>
): WinType[] {
  const completes = (values: number[]) =>
    values.length > 0 &&
    values.includes(newNumber) &&
    values.every((v) => v === newNumber || drawnBefore.has(v));

  const out: WinType[] = [];
  if (completes(card.rows[0])) out.push('row1');
  if (completes(card.rows[1])) out.push('row2');
  if (completes(card.rows[2])) out.push('row3');
  if (completes(card.corners)) out.push('corners');
  if (completes(card.all)) out.push('fullCard');
  return out;
}
