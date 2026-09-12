import { supabase } from '@/lib/supabase';
import { CardIndex, IndexedCard, buildIndex, makeCard } from '@/lib/cardShape';

/**
 * The 900 cards, read from Supabase and kept in memory.
 *
 * Reading them takes a couple of seconds, and the draw endpoint used to do it
 * on every single number. The sets almost never change during a game, so we
 * read them once and keep the result in module scope; a serverless instance
 * reuses it across requests.
 *
 * The rules themselves live in cardShape, which has no database import, so the
 * browser can run the identical logic while offline.
 */

export type { CardIndex, IndexedCard, WinType } from '@/lib/cardShape';
export { WIN_LABELS, winsForCard, winsCompletedBy, makeCard, buildIndex } from '@/lib/cardShape';

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

  return makeCard(setNo, card.card_no, rows);
}

async function fetchIndex(): Promise<CardIndex> {
  const { data, error } = await supabase.from('cards').select(`
    id,
    card_no,
    sets ( set_no ),
    card_rows ( row_no, c1, c2, c3, c4, c5, c6, c7, c8, c9 )
  `);

  if (error) throw error;

  return buildIndex((data || []).map(buildCard));
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
