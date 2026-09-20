'use client';

import { useMemo, useState } from 'react';
import { Check, Layers, ListChecks, X } from 'lucide-react';

/**
 * Which sets are in the room tonight.
 *
 * A hall prints far more booklets than it sells on any one night, and a game
 * played against all of them will sooner or later announce a set nobody is
 * holding — the caller then has to explain to a room why the winner is not
 * there. So before the balls start, the person running the game says which sets
 * went out, and everything after that is judged on those alone.
 *
 * The default is every set, because that is the common case and it must cost
 * nothing: open the screen, press start, play. `null` is that default, and it
 * is kept distinct from "all of them ticked" so a booklet that grows later is
 * still wholly in play.
 *
 * Numbers are entered as a range as well as tapped, because fifty sequential
 * sets is normal and fifty taps is not.
 */

interface Props {
  /** every set this device knows about */
  allSets: number[];
  /** the chosen sets, or null for all of them */
  value: number[] | null;
  onChange: (next: number[] | null) => void;
}

function pad(n: number) {
  return String(n).padStart(3, '0');
}

export default function SetPicker({ allSets, value, onChange }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rangeError, setRangeError] = useState('');

  const chosen = useMemo(() => new Set(value ?? []), [value]);
  const everything = value === null;

  const toggle = (setNo: number) => {
    const next = new Set(chosen);
    if (next.has(setNo)) next.delete(setNo);
    else next.add(setNo);
    onChange([...next].sort((a, b) => a - b));
  };

  /**
   * Add a run of sets in one go.
   *
   * Adds rather than replaces: a hall that sold 001-050 and then 077 on its own
   * should be able to say both without the second erasing the first.
   */
  const addRange = () => {
    const a = Number(from);
    const b = Number(to);
    setRangeError('');

    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1) {
      setRangeError('اكتب رقمين صحيحين');
      return;
    }

    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const known = new Set(allSets);
    const next = new Set(chosen);
    let added = 0;

    for (let n = lo; n <= hi; n++) {
      if (!known.has(n)) continue;
      if (!next.has(n)) added++;
      next.add(n);
    }

    if (added === 0) {
      setRangeError('ماكو سيتات جديدة بهذا المدى');
      return;
    }

    onChange([...next].sort((x, y) => x - y));
    setFrom('');
    setTo('');
  };

  const count = everything ? allSets.length : chosen.size;

  return (
    <div className="flex flex-col gap-3">
      {/* all, or a chosen few */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[11px] font-black border transition-colors cursor-pointer ${
            everything
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <Layers size={13} /> كل السيتات
        </button>

        <button
          type="button"
          onClick={() => onChange(value ?? [])}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[11px] font-black border transition-colors cursor-pointer ${
            !everything
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <ListChecks size={13} /> سيتات محددة
        </button>
      </div>

      {everything ? (
        <p
          className="text-[10px] text-slate-500 leading-relaxed"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          اللعب على كل السيتات ({allSets.length} سيت). أي بطاقة تكدر تربح.
        </p>
      ) : (
        <>
          {/* a run of sets at once — how a hall actually sells them */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label
                className="block text-slate-500 font-bold text-[10px] mb-1"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                من سيت
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="1"
                className="w-full px-2.5 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 text-xs font-mono"
              />
            </div>

            <div className="flex-1">
              <label
                className="block text-slate-500 font-bold text-[10px] mb-1"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                لين سيت
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={String(allSets.length)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 text-xs font-mono"
              />
            </div>

            <button
              type="button"
              onClick={addRange}
              className="py-2 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-black cursor-pointer"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              أضف
            </button>
          </div>

          {rangeError && (
            <p
              className="text-[10px] text-red-400 font-bold"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {rangeError}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-black text-slate-400"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              مختار {count} من {allSets.length} سيت
              <span className="text-slate-600"> · {count * 6} بطاقة</span>
            </span>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onChange([...allSets])}
                className="py-1 px-2.5 rounded-md border border-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-black cursor-pointer"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                أشّر الكل
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="py-1 px-2.5 rounded-md border border-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-black cursor-pointer flex items-center gap-1"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <X size={10} /> فضّي
              </button>
            </div>
          </div>

          {/* every set, tap to take it in or out */}
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 max-h-[220px] overflow-y-auto p-0.5">
            {allSets.map((setNo) => {
              const on = chosen.has(setNo);
              return (
                <button
                  key={setNo}
                  type="button"
                  onClick={() => toggle(setNo)}
                  className={`py-1.5 rounded-lg text-[11px] font-black font-mono border transition-colors cursor-pointer flex items-center justify-center gap-0.5 ${
                    on
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700'
                  }`}
                >
                  {on && <Check size={9} />}
                  {pad(setNo)}
                </button>
              );
            })}
          </div>

          {count === 0 && (
            <p
              className="text-[10px] text-amber-400 font-bold leading-relaxed"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              ما أشّرت ولا سيت — إذا بديت هيج، راح تلعب على كل السيتات.
            </p>
          )}
        </>
      )}
    </div>
  );
}
