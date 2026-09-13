'use client';

import { IndexedCard, WinType, columnOf } from '@/lib/cardShape';

/**
 * A card, drawn the way it is printed.
 *
 * Telling someone "سيت 012 بطاقة 04 ربحت" asks them to go and find the card
 * before they can believe it. Showing the card instead — with the numbers that
 * have come out already filled in and the line that won ringed — answers the
 * question on the spot, and it is the same picture they are holding in their
 * hand, so checking it takes a glance rather than a search.
 *
 * Three rows of nine, blanks included: a number sits in the column its value
 * belongs to (1-9 first, 10-19 second, and so on), which is the rule every set
 * in this app is validated against.
 */

interface Props {
  card: Pick<IndexedCard, 'setNo' | 'cardNo' | 'rows'>;
  /** the numbers that have come out of the drum so far */
  drawn: Set<number>;
  /** the line this card won, if it won one — that row (or the corners) is ringed */
  won?: WinType | null;
  /** how big to draw it */
  size?: 'sm' | 'md';
}

const TONE = {
  sm: { cell: 'text-[10px]', gap: 'gap-[2px]', pad: 'p-1' },
  md: { cell: 'text-xs', gap: 'gap-[3px]', pad: 'p-1.5' },
};

export default function CardGrid({ card, drawn, won = null, size = 'md' }: Props) {
  const tone = TONE[size];

  /** Each row as nine cells, blanks where the card has none. */
  const grid = [0, 1, 2].map((r) => {
    const cells: (number | null)[] = Array(9).fill(null);
    for (const n of card.rows[r] ?? []) {
      let at = columnOf(n);
      while (at < 9 && cells[at] !== null) at++;
      if (at < 9) cells[at] = n;
    }
    return cells;
  });

  /** the four corners, when those are what won */
  const corners = new Set<number>();
  if (won === 'corners') {
    const top = card.rows[0] ?? [];
    const bottom = card.rows[2] ?? [];
    if (top.length) corners.add(top[0]), corners.add(top[top.length - 1]);
    if (bottom.length) corners.add(bottom[0]), corners.add(bottom[bottom.length - 1]);
  }

  const wonRow = won === 'row1' ? 0 : won === 'row2' ? 1 : won === 'row3' ? 2 : -1;

  return (
    <div
      className={`rounded-xl border border-slate-700 bg-slate-950 ${tone.pad} flex flex-col ${tone.gap}`}
      style={{ direction: 'ltr' }}
    >
      {grid.map((row, r) => (
        <div key={r} className={`grid grid-cols-9 ${tone.gap}`}>
          {row.map((n, c) => {
            if (n === null) {
              return (
                <div
                  key={c}
                  className="aspect-square rounded bg-slate-900/60"
                  aria-hidden
                />
              );
            }

            const out = drawn.has(n);
            // the line that won is ringed, so the eye lands on it first
            const inWin = won === 'fullCard' || (wonRow === r) || corners.has(n);

            return (
              <div
                key={c}
                className={`aspect-square rounded flex items-center justify-center font-black ${tone.cell} ${
                  inWin && out
                    ? 'bg-emerald-500 text-ink-fixed ring-1 ring-emerald-300'
                    : out
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-900 text-slate-500'
                }`}
              >
                {n}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
