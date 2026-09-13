'use client';

import { Minus, Plus } from 'lucide-react';
import {
  DEFAULT_PRIZES,
  MAX_PRIZE_COUNT,
  PRIZE_LABELS,
  PRIZE_ORDER,
  PRIZE_SCOPE,
  PrizeKey,
  PrizeRule,
  PrizeSettings,
  normalizePrizes,
} from '@/lib/prizes';

/**
 * The prize rules panel.
 *
 * The rules themselves live in src/lib/prizes — this only draws them. It used
 * to carry its own copy of the list, which is how a panel ends up offering a
 * prize the game does not score, or missing one it does.
 */

export { DEFAULT_PRIZES, PRIZE_LABELS, PRIZE_ORDER, normalizePrizes };
export type { PrizeKey, PrizeRule, PrizeSettings };

const PRIZE_HINTS: Record<PrizeKey, string> = {
  row1: 'السطر الأول من الكرت كامل',
  row2: 'السطر الثاني من الكرت كامل',
  row3: 'السطر الثالث من الكرت كامل',
  corners: 'أول وآخر رقم بالسطر الأول + أول وآخر رقم بالسطر الثالث',
  halfSetCorners: 'زوايا عمود كامل: أطراف السطر الأعلى من البطاقة اللي فوق + أطراف السطر الأسفل من البطاقة اللي تحت',
  setCorners: 'أطراف الورقة الأربع: فوق بطاقة ١ وبطاقة ٤، وتحت بطاقة ٣ وبطاقة ٦',
  fullCard: 'الـ 15 رقم كلها',
};

/** What wins it — a caller reading the list should not have to guess. */
const SCOPE_TAG: Record<PrizeKey, string> = {
  row1: 'بطاقة',
  row2: 'بطاقة',
  row3: 'بطاقة',
  corners: 'بطاقة',
  fullCard: 'بطاقة',
  halfSetCorners: 'نصف سيت',
  setCorners: 'سيت كامل',
};

const MAX_COUNT = MAX_PRIZE_COUNT;

interface Props {
  value: PrizeSettings;
  onChange: (next: PrizeSettings) => void;
  disabled?: boolean;
  /** live "won / allowed" counters, when a game is already running */
  status?: { key: PrizeKey; won: number }[] | null;
}

export default function PrizeSettingsPanel({ value, onChange, disabled, status }: Props) {
  const set = (key: PrizeKey, patch: Partial<PrizeRule>) => {
    onChange({ ...value, [key]: { ...value[key], ...patch } });
  };

  const bump = (key: PrizeKey, delta: number) => {
    const next = Math.min(Math.max(value[key].count + delta, 1), MAX_COUNT);
    set(key, { count: next });
  };

  const wonFor = (key: PrizeKey) => status?.find((s) => s.key === key)?.won;

  return (
    <div className="flex flex-col gap-2">
      {PRIZE_ORDER.map((key) => {
        const rule = value[key];
        const won = wonFor(key);

        return (
          <div
            key={key}
            className={`rounded-2xl border p-3 transition-colors ${
              rule.enabled
                ? 'bg-slate-950 border-slate-800'
                : 'bg-slate-950/40 border-slate-900 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              {/* switch + name */}
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  aria-label={PRIZE_LABELS[key]}
                  disabled={disabled}
                  onClick={() => set(key, { enabled: !rule.enabled })}
                  className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors cursor-pointer disabled:cursor-not-allowed ${
                    rule.enabled ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      rule.enabled ? 'right-0.5' : 'right-[22px]'
                    }`}
                  />
                </button>

                <div className="min-w-0">
                  <div
                    className="text-xs font-black text-slate-100 truncate flex items-center gap-1.5"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    <span className="truncate">{PRIZE_LABELS[key]}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[8px] font-black flex-shrink-0 ${
                        PRIZE_SCOPE[key] === 'set'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : PRIZE_SCOPE[key] === 'half'
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {SCOPE_TAG[key]}
                    </span>
                  </div>
                  <div
                    className="text-[9px] text-slate-500 truncate"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    {PRIZE_HINTS[key]}
                  </div>
                </div>
              </div>

              {/* how many times it pays */}
              <div className="flex items-center gap-1 flex-shrink-0" style={{ direction: 'ltr' }}>
                <button
                  type="button"
                  aria-label="إنقاص العدد"
                  disabled={disabled || !rule.enabled || rule.count <= 1}
                  onClick={() => bump(key, -1)}
                  className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center justify-center disabled:opacity-30 hover:border-slate-700 active:scale-90 transition-all cursor-pointer"
                >
                  <Minus size={13} />
                </button>

                <input
                  type="number"
                  min={1}
                  max={MAX_COUNT}
                  value={rule.count}
                  disabled={disabled || !rule.enabled}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n)) set(key, { count: Math.min(Math.max(n, 1), MAX_COUNT) });
                  }}
                  className="w-11 text-center py-1 text-sm font-black bg-slate-900 border border-slate-800 text-emerald-400 rounded-lg outline-none focus:border-emerald-500 font-mono disabled:opacity-40"
                />

                <button
                  type="button"
                  aria-label="زيادة العدد"
                  disabled={disabled || !rule.enabled || rule.count >= MAX_COUNT}
                  onClick={() => bump(key, 1)}
                  className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center justify-center disabled:opacity-30 hover:border-slate-700 active:scale-90 transition-all cursor-pointer"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            {/* what has already been won, when a game is running */}
            {rule.enabled && won !== undefined && (
              <div
                className="mt-2 pt-2 border-t border-slate-900 text-[10px] font-bold text-slate-400 flex justify-between"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <span>فاز لحد الآن</span>
                <span className={won > 0 ? 'text-emerald-400' : 'text-slate-600'}>
                  {`${won} من ${rule.count}`}
                </span>
              </div>
            )}
          </div>
        );
      })}

      <p
        className="text-[9px] text-slate-500 leading-relaxed text-center mt-1"
        style={{ fontFamily: 'Cairo, sans-serif' }}
      >
        العدد يعني كم مرة تنعطى هذه الجائزة قبل ما تنسد — بطاقة، أو نصف سيت، أو سيت كامل حسب نوعها. تكدر تغيّره حتى وسط الجولة.
      </p>
    </div>
  );
}
