'use client';

import { useCallback, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { BarChart3, Loader2, AlertTriangle, Trophy, Hash, Layers, Ticket } from 'lucide-react';
import { PRIZE_LABELS, PRIZE_ORDER, PrizeKey } from '@/components/PrizeSettings';

/**
 * Club reports.
 *
 * Two questions the caller actually asks between games: which numbers keep
 * coming up, and which cards keep winning. Everything is the club's own data.
 *
 * Every value is printed next to its bar or inside its cell rather than hidden
 * behind a hover — most of the people using this are on a phone, where there is
 * no hover at all.
 */

interface NumberStat {
  number: number;
  count: number;
}

interface CardStat {
  setNo: number;
  cardNo: number;
  wins: number;
  byPrize: Record<PrizeKey, number>;
  sessions: number;
}

interface SessionRow {
  id: string;
  name: string;
  status: string;
  startedAt: string;
}

interface ReportData {
  clubName: string | null;
  sessions: SessionRow[];
  sessionsCount: number;
  drawsCount: number;
  numbers: NumberStat[];
  cards: CardStat[];
  prizeTotals: Partial<Record<PrizeKey, number>>;
  cappedAt: number | null;
}

/**
 * Sequential emerald ramp, darkest = least drawn.
 * Lightness is monotonic and every step clears 4.5:1 against the ink chosen for
 * it, so the number stays readable inside every cell.
 */
const HEAT_STEPS = [
  { bg: '#064e3b', ink: '#ffffff' },
  { bg: '#047857', ink: '#ffffff' },
  { bg: '#10b981', ink: '#022c22' },
  { bg: '#34d399', ink: '#022c22' },
  { bg: '#6ee7b7', ink: '#022c22' },
];

/** Which ramp step a count lands on. Never drawn keeps the bare surface. */
function heatFor(count: number, max: number) {
  if (count === 0 || max === 0) return null;
  const idx = Math.min(HEAT_STEPS.length - 1, Math.floor(((count - 1) / max) * HEAT_STEPS.length));
  return HEAT_STEPS[idx];
}

const TOP_NUMBERS = 12;
const TOP_CARDS = 20;

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-slate-400">
        <Icon size={13} className="text-emerald-400" />
        <span className="text-[10px] font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
          {label}
        </span>
      </div>
      <div className="text-xl font-black text-slate-100 font-mono leading-none mt-0.5">{value}</div>
      {hint && (
        <div className="text-[9px] text-slate-500 font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [showAllCards, setShowAllCards] = useState(false);

  const load = useCallback(async (session: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reports?session=${encodeURIComponent(session)}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
      } else {
        setData(null);
        setError(json.message || 'تعذر إعداد التقارير');
      }
    } catch {
      setData(null);
      setError('تعذر الاتصال بالسيرفر لجلب التقارير');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(sessionFilter);
  }, [sessionFilter, load]);

  const numbers = data?.numbers ?? [];
  const cards = data?.cards ?? [];
  const maxCount = numbers.length > 0 ? numbers[0].count : 0;
  const topNumbers = numbers.filter((n) => n.count > 0).slice(0, TOP_NUMBERS);
  const maxWins = cards.length > 0 ? cards[0].wins : 0;
  const visibleCards = showAllCards ? cards : cards.slice(0, TOP_CARDS);
  const byNumber = new Map(numbers.map((n) => [n.number, n.count]));

  const hasPlayed = (data?.drawsCount ?? 0) > 0;

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'club']}>
      <Navbar />

      <div className="w-full px-4 py-5 flex flex-col gap-4 pb-24 md:pb-10">
        {/* Header + session filter, one row above the charts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-100">
              <BarChart3 className="text-emerald-400" size={20} />
              <h1 className="text-sm font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>
                تقارير النادي
              </h1>
            </div>
            {data?.clubName && (
              <span
                className="text-[10px] font-bold text-slate-400 truncate"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {data.clubName}
              </span>
            )}
          </div>

          <select
            value={sessionFilter}
            onChange={(e) => {
              setSessionFilter(e.target.value);
              setShowAllCards(false);
            }}
            disabled={loading}
            className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 transition-colors cursor-pointer disabled:opacity-50"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <option value="all">كل الجلسات</option>
            {(data?.sessions ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500 font-bold">
            <Loader2 className="animate-spin text-emerald-500" size={24} />
            <span className="text-xs" style={{ fontFamily: 'Cairo, sans-serif' }}>
              جاري إعداد التقارير...
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-500/10 border border-red-500/25 text-red-400 p-4 rounded-2xl flex items-center gap-2.5 text-xs font-bold">
            <AlertTriangle size={18} className="flex-shrink-0" />
            <span style={{ fontFamily: 'Cairo, sans-serif' }}>{error}</span>
          </div>
        )}

        {!loading && !error && data && !hasPlayed && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-slate-800/60 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <BarChart3 size={26} />
            </div>
            <p
              className="text-xs font-bold text-slate-400 leading-relaxed"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              ما اكو بيانات بعد. العب جلسة وحدة وارجع لهنا — التقارير تنبني من الأرقام المسحوبة
              نفسها.
            </p>
          </div>
        )}

        {!loading && !error && data && hasPlayed && (
          <>
            {/* Headline numbers */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <StatTile
                icon={Layers}
                label="الجلسات"
                value={String(data.sessionsCount)}
                hint={sessionFilter === 'all' ? 'كل الجلسات' : 'جلسة وحدة'}
              />
              <StatTile icon={Hash} label="أرقام مسحوبة" value={String(data.drawsCount)} />
              <StatTile
                icon={Ticket}
                label="بطاقات فائزة"
                value={String(cards.length)}
                hint={`${cards.reduce((s, c) => s + c.wins, 0)} جائزة`}
              />
              <StatTile
                icon={Trophy}
                label="أكثر رقم نزولاً"
                value={topNumbers.length > 0 ? String(topNumbers[0].number) : '-'}
                hint={topNumbers.length > 0 ? `${topNumbers[0].count} مرة` : undefined}
              />
            </div>

            {/* ---------------- Most-drawn numbers ---------------- */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
              <div>
                <h2
                  className="text-xs font-black text-slate-100 flex items-center gap-1.5"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  <Hash size={14} className="text-emerald-400" /> أكثر الأرقام نزولاً
                </h2>
                <p
                  className="text-[10px] text-slate-500 mt-1"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  كم مرة نزل كل رقم عبر {data.sessionsCount === 1 ? 'الجلسة' : `${data.sessionsCount} جلسة`}.
                  السحب عشوائي، فالفروق بين الأرقام عادة تطلع بسيطة.
                </p>
              </div>

              {/* Ranked bars — one series, every value labelled */}
              <div className="flex flex-col gap-1.5 w-full max-w-3xl mx-auto">
                {topNumbers.map((n, i) => (
                  <div key={n.number} className="flex items-center gap-2">
                    <span className="w-5 text-[9px] font-black text-slate-600 font-mono text-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="w-8 text-xs font-black text-slate-200 font-mono text-center bg-slate-950 border border-slate-800 rounded-lg py-1 flex-shrink-0">
                      {n.number}
                    </span>
                    <div className="flex-1 h-5 bg-slate-950 rounded-[4px] overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-[4px]"
                        style={{ width: `${maxCount ? (n.count / maxCount) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-8 text-[11px] font-black text-emerald-400 font-mono text-left flex-shrink-0">
                      {n.count}
                    </span>
                  </div>
                ))}
              </div>

              {/* The whole board, 1-90, shaded by how often it came up */}
              <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between mb-2.5 w-full max-w-lg mx-auto">
                  <span
                    className="text-[10px] font-bold text-slate-400"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    اللوحة كاملة (1 - 90)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[9px] font-bold text-slate-500"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      أقل
                    </span>
                    <div className="flex gap-0.5">
                      {HEAT_STEPS.map((s) => (
                        <span
                          key={s.bg}
                          className="w-3.5 h-3.5 rounded-[3px]"
                          style={{ background: s.bg }}
                        />
                      ))}
                    </div>
                    <span
                      className="text-[9px] font-bold text-slate-500"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      أكثر
                    </span>
                  </div>
                </div>

                <div
                  className="grid grid-cols-10 gap-1 w-full max-w-lg mx-auto"
                  style={{ direction: 'ltr' }}
                >
                  {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => {
                    const count = byNumber.get(n) || 0;
                    const step = heatFor(count, maxCount);
                    return (
                      <div
                        key={n}
                        title={`الرقم ${n}: نزل ${count} مرة`}
                        className={`aspect-square w-full rounded flex flex-col items-center justify-center leading-none ${
                          step ? '' : 'bg-slate-950 border border-slate-800/80'
                        }`}
                        style={step ? { background: step.bg, color: step.ink } : undefined}
                      >
                        <span
                          className={`text-[10px] font-black ${step ? '' : 'text-slate-600'}`}
                        >
                          {n}
                        </span>
                        <span
                          className={`text-[7px] font-bold ${step ? 'opacity-75' : 'text-slate-700'}`}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p
                  className="text-[9px] text-slate-500 text-center mt-2.5"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  الرقم الكبير هو رقم الكرة، والصغير تحته كم مرة نزلت.
                </p>
              </div>
            </section>

            {/* ---------------- Most-winning cards ---------------- */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
              <div>
                <h2
                  className="text-xs font-black text-slate-100 flex items-center gap-1.5"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  <Trophy size={14} className="text-amber-400" /> أكثر البطايق ربحاً
                </h2>
                <p
                  className="text-[10px] text-slate-500 mt-1 leading-relaxed"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  الجوائز الي فعلاً انستلمت. خط اكتمل بعد ما انسدت جائزته ما ينحسب فوز.
                </p>
              </div>

              {/* Prize mix across the whole period */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {PRIZE_ORDER.map((key, i) => (
                  <div
                    key={key}
                    className={`px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 ${
                      i === PRIZE_ORDER.length - 1 && PRIZE_ORDER.length % 2 === 1
                        ? 'col-span-2 sm:col-span-1'
                        : ''
                    }`}
                  >
                    <span
                      className="text-[10px] font-bold text-slate-400 truncate"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      {PRIZE_LABELS[key]}
                    </span>
                    <span className="text-[11px] font-black text-slate-200 font-mono flex-shrink-0">
                      {data.prizeTotals[key] ?? 0}
                    </span>
                  </div>
                ))}
              </div>

              {cards.length === 0 ? (
                <p
                  className="text-[11px] text-slate-500 text-center py-6 font-bold"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  ما اكو بطاقة ربحت بعد ضمن هذا النطاق.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5 w-full max-w-3xl mx-auto">
                    {visibleCards.map((c, i) => (
                      <div
                        key={`${c.setNo}:${c.cardNo}`}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-[9px] font-black text-slate-600 font-mono text-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <span
                            className="text-[11px] font-black text-slate-200 flex-shrink-0"
                            style={{ fontFamily: 'Cairo, sans-serif' }}
                          >
                            سيت {String(c.setNo).padStart(3, '0')} · كرت{' '}
                            {String(c.cardNo).padStart(2, '0')}
                          </span>
                          <div className="flex-1 h-4 bg-slate-900 rounded-[4px] overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-[4px]"
                              style={{ width: `${maxWins ? (c.wins / maxWins) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-black text-amber-400 font-mono flex-shrink-0">
                            {c.wins}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1 pr-7">
                          {PRIZE_ORDER.filter((key) => (c.byPrize[key] ?? 0) > 0).map((key) => (
                            <span
                              key={key}
                              className="px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[9px] font-bold text-slate-400"
                              style={{ fontFamily: 'Cairo, sans-serif' }}
                            >
                              {PRIZE_LABELS[key]}
                              {(c.byPrize[key] ?? 0) > 1 ? ` · ${c.byPrize[key]}` : ''}
                            </span>
                          ))}
                          {c.sessions > 1 && (
                            <span
                              className="px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[9px] font-bold text-slate-500"
                              style={{ fontFamily: 'Cairo, sans-serif' }}
                            >
                              بـ {c.sessions} جلسات
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {cards.length > TOP_CARDS && (
                    <button
                      onClick={() => setShowAllCards((v) => !v)}
                      className="w-full py-2.5 text-[11px] font-bold border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      {showAllCards
                        ? 'عرض الأوائل فقط'
                        : `عرض كل البطاقات الفائزة (${cards.length})`}
                    </button>
                  )}
                </>
              )}
            </section>

            {data.cappedAt && (
              <p
                className="text-[9px] text-slate-500 text-center"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                التقرير يغطي آخر {data.cappedAt} جلسة.
              </p>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
