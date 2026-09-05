'use client';

import { Minus, Plus, Infinity as InfinityIcon } from 'lucide-react';

/**
 * The prize rules panel.
 *
 * Mirrors src/lib/prizes.ts: every prize can be switched off, the line prizes
 * carry "how many times it pays", and الزوايا sits outside the counting —
 * whenever a card's corners come up, it wins.
 */

export type PrizeKey = 'row1' | 'row2' | 'row3' | 'corners' | 'fullCard';

export interface PrizeRule {
  enabled: boolean;
  count: number;
}

export type PrizeSettings = Record<PrizeKey, PrizeRule>;

export const PRIZE_ORDER: PrizeKey[] = ['row1', 'row2', 'row3', 'corners', 'fullCard'];

export const PRIZE_LABELS: Record<PrizeKey, string> = {
  row1: 'الخط الأول',
  row2: 'الخط الثاني',
  row3: 'الخط الثالث',
  corners: 'الزوايا',
  fullCard: 'البطاقة كاملة (دمبلة)',
};

const PRIZE_HINTS: Record<PrizeKey, string> = {
  row1: 'السطر الأول من الكرت كامل',
  row2: 'السطر الثاني من الكرت كامل',
  row3: 'السطر الثالث من الكرت كامل',
  corners: 'أول وآخر رقم بالسطر الأول + أول وآخر رقم بالسطر الثالث',
  fullCard: 'الـ 15 رقم كلها',
};

/** الزوايا لا تُعدّ — تربح كل ما تطلع. */
export const UNLIMITED: PrizeKey[] = ['corners'];

export const DEFAULT_PRIZES: PrizeSettings = {
  row1: { enabled: true, count: 1 },
  row2: { enabled: true, count: 1 },
  row3: { enabled: true, count: 1 },
  corners: { enabled: true, count: 0 },
  fullCard: { enabled: true, count: 1 },
};

const MAX_COUNT = 99;

export function normalizePrizes(raw: any): PrizeSettings {
  const out = {} as PrizeSettings;
  for (const key of PRIZE_ORDER) {
    const fallback = DEFAULT_PRIZES[key];
    const given = raw && typeof raw === 'object' ? raw[key] : null;
    if (!given || typeof given !== 'object') {
      out[key] = { ...fallback };
      continue;
    }
    const count = Number(given.count);
    out[key] = {
      enabled: given.enabled === undefined ? fallback.enabled : Boolean(given.enabled),
      count: UNLIMITED.includes(key)
        ? 0
        : !isFinite(count) || count < 1
        ? fallback.count
        : Math.min(Math.floor(count), MAX_COUNT),
    };
  }
  return out;
}

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
        const unlimited = UNLIMITED.includes(key);
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
                    className="text-xs font-black text-slate-100 truncate"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    {PRIZE_LABELS[key]}
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
              {unlimited ? (
                <div
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-black flex-shrink-0"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  <InfinityIcon size={12} />
                  <span>غير محدود</span>
                </div>
              ) : (
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
              )}
            </div>

            {/* what has already been won, when a game is running */}
            {rule.enabled && won !== undefined && (
              <div
                className="mt-2 pt-2 border-t border-slate-900 text-[10px] font-bold text-slate-400 flex justify-between"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <span>فاز لحد الآن</span>
                <span className={won > 0 ? 'text-emerald-400' : 'text-slate-600'}>
                  {unlimited ? `${won} بطاقة` : `${won} من ${rule.count}`}
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
        العدد يعني كم بطاقة تربح هذا الخط قبل ما ينسد. الزوايا خارج العدّ — أي بطاقة تكمل زواياها
        تربح.
      </p>
    </div>
  );
}
