'use client';

import { IndexedCard, WinType, columnOf } from '@/lib/cardShape';

/**
 * A card, drawn exactly as it is printed.
 *
 * Whoever is holding the winning card is holding the paper version of this,
 * and the caller's job in that moment is to check one against the other. So
 * this is not a stylised version of a card — it is the set sheet's own grid,
 * the same white paper, the same thin black rules, the same set number on the
 * left and booklet number on the right, sized down. The only things added are
 * the two facts the paper cannot carry: which numbers have already come out,
 * and which line took the prize.
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

/**
 * On the printed booklet each card carries two numbers: the set number on the
 * left and a running card number on the right that continues across the whole
 * booklet. Same rule as the sheet page, so the two always agree.
 */
function bookletNo(setNo: number, cardNo: number) {
  return (setNo - 1) * 6 + cardNo;
}

export default function CardGrid({ card, drawn, won = null, size = 'md' }: Props) {
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
    if (top.length) {
      corners.add(top[0]);
      corners.add(top[top.length - 1]);
    }
    if (bottom.length) {
      corners.add(bottom[0]);
      corners.add(bottom[bottom.length - 1]);
    }
  }

  const wonRow = won === 'row1' ? 0 : won === 'row2' ? 1 : won === 'row3' ? 2 : -1;

  return (
    <div className={`card-paper${size === 'sm' ? ' is-small' : ''}`}>
      <div className="sheet-card-nums">
        <span>{card.setNo}</span>
        <span>{bookletNo(card.setNo, card.cardNo)}</span>
      </div>

      <table className="sheet-grid">
        <tbody>
          {grid.map((row, r) => (
            <tr key={r}>
              {row.map((n, c) => {
                if (n === null) return <td key={c} />;

                const out = drawn.has(n);
                const inWin = won === 'fullCard' || wonRow === r || corners.has(n);

                return (
                  <td
                    key={c}
                    className={`${out ? 'is-out' : ''}${inWin ? ' is-win' : ''}`.trim()}
                  >
                    {n}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
