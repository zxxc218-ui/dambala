import { supabase } from '@/lib/supabase';

/**
 * A card, flattened into just the numbers each win type needs.
 *
 * Reading the 900 cards out of Supabase takes a couple of seconds, and the draw
 * endpoint used to do it on every single number. The sets almost never change
 * during a game, so we read them once and keep the result in module scope; a
 * serverless instance reuses it across requests.
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

const COLUMNS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'] as const;
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: CardIndex | null = null;
let inFlight: Promise<CardIndex> | null = null;

/** Numbers of one row, left to right, blanks removed. */
function rowNumbers(row: any): number[] {
  const out: number[] = [];
  for (const col of COLUMNS) {
    const v = row?.[col];
    if (v !== null && v !== undefined) out.push(Number(v));
  }
  return out;
}

function buildCard(card: any): IndexedCard {
  const setNo = card?.sets?.set_no ?? card?.sets?.[0]?.set_no ?? 0;
  const rawRows = card.card_rows || [];

  const rows: number[][] = [1, 2, 3].map((rowNo) => {
    const row = rawRows.find((r: any) => r.row_no === rowNo);
    return row ? rowNumbers(row) : [];
  });

  const all = rows.flat();

  const corners: number[] = [];
  const top = rows[0];
  const bottom = rows[2];
  if (top.length > 0) corners.push(top[0], top[top.length - 1]);
  if (bottom.length > 0) corners.push(bottom[0], bottom[bottom.length - 1]);

  return { setNo, cardNo: card.card_no, rows, all, corners };
}

async function fetchIndex(): Promise<CardIndex> {
  const { data, error } = await supabase.from('cards').select(`
    id,
    card_no,
    sets ( set_no ),
    card_rows ( row_no, c1, c2, c3, c4, c5, c6, c7, c8, c9 )
  `);

  if (error) throw error;

  const cards = (data || []).map(buildCard);
  cards.sort((a, b) => (a.setNo !== b.setNo ? a.setNo - b.setNo : a.cardNo - b.cardNo));

  const byNumber = new Map<number, number[]>();
  cards.forEach((card, idx) => {
    for (const n of card.all) {
      const list = byNumber.get(n);
      if (list) list.push(idx);
      else byNumber.set(n, [idx]);
    }
  });

  return { cards, byNumber, builtAt: Date.now() };
}

/** The cached card index, rebuilt on demand. Concurrent callers share one fetch. */
export async function getCardIndex(): Promise<CardIndex> {
  if (cache && Date.now() - cache.builtAt < CACHE_TTL_MS) return cache;
  if (inFlight) return inFlight;

  inFlight = fetchIndex()
    .then((idx) => {
      cache = idx;
      return idx;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Call after any write that changes sets, cards or rows. */
export function invalidateCardIndex() {
  cache = null;
}

export type WinType = 'row1' | 'row2' | 'row3' | 'corners' | 'fullCard';

export const WIN_LABELS: Record<WinType, string> = {
  row1: 'الخط الأول',
  row2: 'الخط الثاني',
  row3: 'الخط الثالث',
  corners: 'الزوايا',
  fullCard: 'البطاقة كاملة (دمبلة)',
};

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
