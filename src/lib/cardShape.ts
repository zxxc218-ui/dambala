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

/**
 * Half a set: one column of the printed page.
 *
 * A set is printed as six cards in two columns of three, and the hall plays the
 * two columns as separate things — the sheet itself says so, along its head:
 * الزوايا · السيت · نصف السيت · بطاقة. So a half is a real object in this game
 * and not a way of slicing one: it has its own four corners, taken from the top
 * of its top card and the bottom of its bottom card.
 */
export type HalfKey = 'left' | 'right';

export interface SetHalf {
  key: HalfKey;
  /** the cards of this column, top to bottom */
  cards: IndexedCard[];
  /** first and last number of the top row, first and last of the bottom row */
  corners: number[];
}

export interface SetGroup {
  setNo: number;
  /** all six cards, in card order */
  cards: IndexedCard[];
  halves: SetHalf[];
  /** the four corners of the whole printed page */
  corners: number[];
}

export interface CardIndex {
  cards: IndexedCard[];
  /** number (1..90) -> indexes into `cards` of every card holding it */
  byNumber: Map<number, number[]>;
  /** the same cards grouped as they are printed: sets, and halves of sets */
  sets: SetGroup[];
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

/**
 * Which of the nine columns a number belongs in.
 *
 * Not a convention this app invented: a tambola card puts 1-9 in the first
 * column, 10-19 in the second, and so on to 80-90 in the ninth, and the
 * importer validates every set against exactly that. So a row's numbers alone
 * are enough to put the blanks back where they belong when drawing a card.
 */
export function columnOf(value: number): number {
  if (value <= 9) return 0;
  return Math.min(8, Math.floor(value / 10));
}

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

/** First and last number of one row, blanks already removed. */
function ends(card: IndexedCard, rowNo: number): number[] {
  const row = card.rows[rowNo] ?? [];
  return row.length > 0 ? [row[0], row[row.length - 1]] : [];
}

/**
 * The corners of a block of cards stacked in one column.
 *
 * The same idea as a card's corners, one size up: the two ends of the top row
 * of the card at the top, and the two ends of the bottom row of the card at the
 * bottom. What is in between does not matter — which is exactly how it looks on
 * paper, and why a caller can check it at a glance.
 */
function stackCorners(column: IndexedCard[]): number[] {
  if (column.length === 0) return [];
  return [...ends(column[0], 0), ...ends(column[column.length - 1], 2)];
}

/**
 * Group the cards the way the page prints them.
 *
 * The sheet lays a set out in two columns of three — cards 1,2,3 on the left
 * and 4,5,6 on the right — so that is how the halves are cut here, and the
 * corners of the whole page come from the outer corners of those two columns.
 */
function groupSets(sorted: IndexedCard[]): SetGroup[] {
  const bySet = new Map<number, IndexedCard[]>();
  for (const card of sorted) {
    const list = bySet.get(card.setNo);
    if (list) list.push(card);
    else bySet.set(card.setNo, [card]);
  }

  const groups: SetGroup[] = [];
  for (const [setNo, cards] of bySet) {
    // a half needs a top and a bottom; a set printed some other way is left
    // ungrouped rather than guessed at
    if (cards.length < 2) continue;

    const cut = Math.ceil(cards.length / 2);
    const left = cards.slice(0, cut);
    const right = cards.slice(cut);
    if (right.length === 0) continue;

    const halves: SetHalf[] = [
      { key: 'left', cards: left, corners: stackCorners(left) },
      { key: 'right', cards: right, corners: stackCorners(right) },
    ];

    groups.push({
      setNo,
      cards,
      halves,
      // the outer four: top of the left column, top of the right, bottom of
      // the left, bottom of the right — the four corners of the paper
      corners: [
        ...ends(left[0], 0).slice(0, 1),
        ...ends(right[0], 0).slice(1),
        ...ends(left[left.length - 1], 2).slice(0, 1),
        ...ends(right[right.length - 1], 2).slice(1),
      ],
    });
  }

  return groups.sort((a, b) => a.setNo - b.setNo);
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

  return { cards: sorted, byNumber, sets: groupSets(sorted), builtAt: Date.now() };
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

/**
 * The same index, narrowed to the sets that are actually in play.
 *
 * A hall does not always sell every booklet it has printed. When only some sets
 * were sold, the ones that were not are not in the room — nobody is holding
 * them, so nobody can claim on them, and a game that keeps ranking them will
 * sooner or later announce a winner who does not exist.
 *
 * Narrowing here rather than at each prize is deliberate: past this point the
 * rest of the game has no idea some sets were left out, because as far as it
 * can see those cards were never printed. One filter, and every prize — a card,
 * half a set, a whole set — is right for free.
 *
 * `sets` empty or null means the whole booklet is in play, which is the normal
 * case and costs nothing.
 */
export function restrictToSets(index: CardIndex, sets: number[] | null | undefined): CardIndex {
  if (!sets || sets.length === 0) return index;

  const wanted = new Set(sets);
  const kept = index.cards.filter((card) => wanted.has(card.setNo));

  // asking for sets that are not in this copy of the booklet would otherwise
  // leave an empty game that silently never pays anything
  if (kept.length === 0) return index;
  if (kept.length === index.cards.length) return index;

  return buildIndex(kept);
}
