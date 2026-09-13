'use client';

import { localCardIndex } from '@/lib/localCards';

/**
 * The sets, rebuilt from the copy of the cards kept on this device.
 *
 * The pages that show and print cards were written against the server's shape,
 * so this hands back exactly that shape — the caller cannot tell whether the
 * answer came over the network or off the device, which is the point.
 *
 * The device copy stores each row as its numbers with the blanks squeezed out,
 * because that is all the win rules need. The printed card needs the blanks
 * back in the right places, and it gets them from the number itself: in a
 * tambola card a number can only ever sit in the column its value belongs to —
 * 1..9 in the first, 10..19 in the second, and so on to 80..90 in the ninth.
 * That is not a convention this app invented, it is the rule the importer
 * validates every set against, so the reconstruction is exact.
 */

export interface LocalRow {
  rowNo: number;
  c1: number | null;
  c2: number | null;
  c3: number | null;
  c4: number | null;
  c5: number | null;
  c6: number | null;
  c7: number | null;
  c8: number | null;
  c9: number | null;
}

export interface LocalCard {
  id: string;
  cardNo: number;
  rows: LocalRow[];
}

export interface LocalSet {
  id: string;
  setNo: number;
  createdAt?: string;
  cards: LocalCard[];
}

/** Which of the nine columns a number belongs in. */
export function columnOf(value: number): number {
  if (value <= 9) return 0;
  return Math.min(8, Math.floor(value / 10));
}

function toRow(rowNo: number, numbers: number[]): LocalRow {
  const cells: (number | null)[] = [null, null, null, null, null, null, null, null, null];
  for (const n of numbers) {
    const col = columnOf(n);
    // Two numbers claiming one column would mean a set that never passed
    // validation; keep the first and let the second fall into the next free
    // cell rather than vanishing from the printed card.
    let at = col;
    while (at < 9 && cells[at] !== null) at++;
    if (at < 9) cells[at] = n;
  }
  return {
    rowNo,
    c1: cells[0], c2: cells[1], c3: cells[2], c4: cells[3], c5: cells[4],
    c6: cells[5], c7: cells[6], c8: cells[7], c9: cells[8],
  };
}

/** Every set on this device, in order, with their cards. */
export function localSets(): LocalSet[] | null {
  const index = localCardIndex();
  if (!index) return null;

  const bySet = new Map<number, LocalCard[]>();
  for (const card of index.cards) {
    const cards = bySet.get(card.setNo) ?? [];
    cards.push({
      id: `local-${card.setNo}-${card.cardNo}`,
      cardNo: card.cardNo,
      rows: [0, 1, 2].map((i) => toRow(i + 1, card.rows[i] ?? [])),
    });
    bySet.set(card.setNo, cards);
  }

  return [...bySet.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([setNo, cards]) => ({
      id: `local-set-${setNo}`,
      setNo,
      cards: cards.sort((a, b) => a.cardNo - b.cardNo),
    }));
}

/** One set, in the shape /api/sets/[setNo] returns. */
export function localSet(setNo: number): LocalSet | null {
  const all = localSets();
  if (!all) return null;
  return all.find((s) => s.setNo === setNo) ?? null;
}

/**
 * The set list, in the shape /api/sets returns.
 *
 * `isValid` is reported true: this copy came from the server, which only ever
 * serves cards it stored, and the device has no way to re-run the importer's
 * checks. The admin screen that cares about validation is online-only anyway.
 */
export function localSetList(): { id: string; setNo: number; isValid: boolean; errorsCount: number }[] | null {
  const all = localSets();
  if (!all) return null;
  return all.map((s) => ({ id: s.id, setNo: s.setNo, isValid: true, errorsCount: 0 }));
}
