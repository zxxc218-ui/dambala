'use client';

import { IndexedCard, columnOf } from '@/lib/cardShape';

/**
 * A win, drawn exactly as it is printed.
 *
 * Whoever is holding the winning card is holding the paper version of this, and
 * the caller's job in that moment is to check one against the other. So this is
 * not a stylised card — it is the set sheet's own grid: the same white paper,
 * the same thin black rules, the set number on the left and the booklet number
 * on the right.
 *
 * It draws whatever the prize was won by, because the corner prizes come at
 * three sizes: one card, one column of three (half a set), or the whole page of
 * six. Same picture, more of it. Only two things are added, because the paper
 * cannot carry them: the balls already out are filled in, and the numbers that
 * made up the win are ringed.
 */

interface Props {
  /** cards in printed column order — one column, or the two of a full page */
  columns: IndexedCard[][];
  /** the numbers that have come out of the drum so far */
  drawn: Set<number>;
  /** the numbers the prize is made of */
  highlight?: Iterable<number> | null;
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

/** One row as nine cells, blanks where the card has none. */
function cellsOf(row: number[]): (number | null)[] {
  const cells: (number | null)[] = Array(9).fill(null);
  for (const n of row) {
    let at = columnOf(n);
    while (at < 9 && cells[at] !== null) at++;
    if (at < 9) cells[at] = n;
  }
  return cells;
}

export default function CardGrid({ columns, drawn, highlight, size = 'md' }: Props) {
  const ringed = new Set(highlight ?? []);

  return (
    <div className={`card-paper${size === 'sm' ? ' is-small' : ''}`}>
      <div className="cols">
        {columns.map((column, ci) => (
          <div className="col" key={ci}>
            {column.map((card) => (
              <div key={`${card.setNo}-${card.cardNo}`}>
                <div className="sheet-card-nums">
                  <span>{card.setNo}</span>
                  <span>{bookletNo(card.setNo, card.cardNo)}</span>
                </div>

                <table className="sheet-grid">
                  <tbody>
                    {[0, 1, 2].map((r) => (
                      <tr key={r}>
                        {cellsOf(card.rows[r] ?? []).map((n, c) => {
                          if (n === null) return <td key={c} />;
                          const out = drawn.has(n);
                          const inWin = ringed.has(n);
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
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
