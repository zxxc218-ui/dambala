'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import CardGrid from '@/components/CardGrid';
import { Calendar, Loader2, Award, Hash, ChevronDown, History, CloudOff } from 'lucide-react';
import {
  HALF_LABELS,
  PRIZE_LABELS,
  PRIZE_ORDER,
  PRIZE_SCOPE,
  PrizeKey,
  PrizeSettings,
  computeStandings,
  orderMap,
  winPicture,
} from '@/lib/prizes';
import { CardIndex, HalfKey } from '@/lib/cardShape';
import { ensureLocalCards, localCardIndex } from '@/lib/localCards';

/**
 * Every game this club has played, kept.
 *
 * One row per session with the night it was played and how many balls came out,
 * and opening one shows that session's numbers in the order they were called
 * and the cards that won it.
 *
 * The winners are worked out here, from that session's own numbers and that
 * session's own prize rules. Nothing is read from a shared list, so a session
 * can only ever show its own winners — the answer is built from the session or
 * it does not exist at all.
 */

interface SessionRow {
  id: number;
  name: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  _count: { numbers: number };
}

interface SessionDetail {
  id: number;
  name: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  numbers: { number: number; drawOrder: number }[];
  prizes: PrizeSettings;
}

interface WinnerRow {
  key: PrizeKey;
  place: number;
  count: number;
  setNo: number;
  /** set only when a single card won */
  cardNo?: number;
  /** set only when one column of a set won */
  half?: HalfKey;
  at: number;
}

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });
};

const fmtTime = (iso: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [cardsReady, setCardsReady] = useState(false);

  useEffect(() => {
    void ensureLocalCards().then((idx) => setCardsReady(Boolean(idx)));

    (async () => {
      try {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        if (data.success) {
          setSessions(data.sessions);
        } else {
          setError(data.message || 'تعذر جلب الجلسات');
          setSessions([]);
        }
      } catch {
        setError('ماكو نت — خانة الجلسات تحتاج اتصال، لأن الجلسات محفوظة بالسيرفر.');
        setSessions([]);
      }
    })();
  }, []);

  const open = async (id: number) => {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }

    setOpenId(id);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json();
      if (data.success) setDetail(data.session);
      else setError(data.message || 'تعذر فتح الجلسة');
    } catch {
      setError('تعذر فتح الجلسة — ماكو اتصال.');
    } finally {
      setLoadingDetail(false);
    }
  };

  /** The cards that took a prize in THIS session, and nothing else. */
  const winnersOf = (s: SessionDetail): WinnerRow[] | null => {
    const index = localCardIndex();
    if (!index) return null;

    const standings = computeStandings(
      index,
      orderMap(s.numbers.map((n) => ({ number: n.number, draw_order: n.drawOrder }))),
      s.prizes
    );

    const rows: WinnerRow[] = [];
    for (const key of PRIZE_ORDER) {
      standings[key].winners.forEach((w, i) => {
        rows.push({
          key,
          place: i + 1,
          count: standings[key].count,
          setNo: w.setNo,
          cardNo: w.cardNo,
          half: w.half,
          at: w.at,
        });
      });
    }
    return rows;
  };

  const cardsIndex = (): CardIndex | null => localCardIndex();

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'club']}>
      <Navbar />
      <div className="w-full px-4 py-5 flex flex-col gap-4 pb-24">
        <div>
          <h1
            className="text-lg font-black text-slate-100 flex items-center gap-2"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <History className="text-emerald-400" size={20} /> الجلسات المحفوظة
          </h1>
          <p
            className="text-slate-400 text-xs mt-1 leading-relaxed"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            كل جولة لعبتها، بتاريخها وأرقامها وبطايقها الفائزة. افتح أي جلسة تشوف تفاصيلها.
          </p>
        </div>

        {error && (
          <div
            className="bg-amber-500/10 border border-amber-500/25 text-amber-400 p-3 rounded-xl text-[11px] font-bold flex items-start gap-2 leading-relaxed"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <CloudOff size={15} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!cardsReady && (
          <div
            className="bg-slate-900 border border-slate-800 text-slate-400 p-3 rounded-xl text-[11px] font-bold leading-relaxed"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            ما وصلت نسخة السيتات لهذا الجهاز بعد، فما أكدر أطلّع الفائزين. افتح البرنامج مرة وحدة وهو
            متصل بالنت.
          </div>
        )}

        {sessions === null ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
            <Loader2 className="animate-spin text-emerald-500" size={24} />
            <span className="text-xs font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
              جاري جلب الجلسات...
            </span>
          </div>
        ) : sessions.length === 0 ? (
          <div
            className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl py-12 text-center text-slate-500 text-xs font-bold"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            ما كو جلسات محفوظة بعد.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((s) => {
              const isOpen = openId === s.id;
              return (
                <div
                  key={s.id}
                  className={`rounded-2xl border transition-colors ${
                    isOpen ? 'border-emerald-500/30 bg-slate-900' : 'border-slate-800 bg-slate-900/60'
                  }`}
                >
                  <button
                    onClick={() => open(s.id)}
                    className="w-full p-3.5 flex items-center gap-3 text-right cursor-pointer"
                  >
                    <ChevronDown
                      size={16}
                      className={`flex-shrink-0 text-slate-500 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-black text-slate-200 truncate"
                        style={{ fontFamily: 'Cairo, sans-serif' }}
                      >
                        {s.name}
                      </p>
                      <p
                        className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5 mt-0.5"
                        style={{ fontFamily: 'Cairo, sans-serif' }}
                      >
                        <Calendar size={11} />
                        {fmtDate(s.startedAt)}
                        <span className="font-mono" style={{ direction: 'ltr' }}>
                          {fmtTime(s.startedAt)}
                        </span>
                      </p>
                    </div>

                    <span
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-black text-slate-300 flex-shrink-0"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      <Hash size={10} />
                      <span className="font-mono">{s._count.numbers}</span>
                    </span>

                    {s.status !== 'finished' && (
                      <span
                        className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[9px] font-black flex-shrink-0"
                        style={{ fontFamily: 'Cairo, sans-serif' }}
                      >
                        شغالة
                      </span>
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-3.5 pb-3.5 flex flex-col gap-3 border-t border-slate-800 pt-3">
                      {loadingDetail || !detail ? (
                        <div className="flex items-center justify-center py-6 text-slate-500">
                          <Loader2 className="animate-spin text-emerald-500" size={18} />
                        </div>
                      ) : (
                        <SessionBody
                          detail={detail}
                          winners={winnersOf(detail)}
                          index={cardsIndex()}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

/* --------------------------------------------------------------------- */

function SessionBody({
  detail,
  winners,
  index,
}: {
  detail: SessionDetail;
  winners: WinnerRow[] | null;
  index: CardIndex | null;
}) {
  const drawn = new Set(detail.numbers.map((n) => n.number));

  return (
    <>
      {/* when it ran */}
      <div
        className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-slate-400"
        style={{ fontFamily: 'Cairo, sans-serif' }}
      >
        <span>
          بدأت: {fmtDate(detail.startedAt)}{' '}
          <span className="font-mono" style={{ direction: 'ltr' }}>
            {fmtTime(detail.startedAt)}
          </span>
        </span>
        {detail.endedAt && (
          <span>
            خلصت: {fmtDate(detail.endedAt)}{' '}
            <span className="font-mono" style={{ direction: 'ltr' }}>
              {fmtTime(detail.endedAt)}
            </span>
          </span>
        )}
      </div>

      {/* the balls, in the order they came out */}
      <div>
        <h4
          className="text-[10px] font-black text-slate-400 mb-1.5"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          الأرقام النازلة ({detail.numbers.length})
        </h4>
        {detail.numbers.length === 0 ? (
          <p className="text-[10px] text-slate-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
            ما نزل ولا رقم بهاي الجلسة.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1" style={{ direction: 'ltr' }}>
            {detail.numbers.map((n) => (
              <span
                key={n.number}
                title={`رقم ${n.drawOrder}`}
                className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center text-[10px] font-black font-mono"
              >
                {n.number}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* who won THIS session */}
      <div>
        <h4
          className="text-[10px] font-black text-slate-400 mb-1.5 flex items-center gap-1.5"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <Award size={12} className="text-amber-400" /> فائزو هذه الجلسة
        </h4>

        {winners === null ? (
          <p className="text-[10px] text-slate-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
            محتاج نسخة السيتات بالجهاز حتى أطلّع الفائزين.
          </p>
        ) : winners.length === 0 ? (
          <p className="text-[10px] text-slate-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
            ما فازت ولا بطاقة بهاي الجلسة.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {winners.map((w, i) => {
              const picture = index ? winPicture(index, w) : null;
              const wide = (picture?.columns.length ?? 1) > 1;
              return (
                <div
                  key={`${w.key}-${i}`}
                  className={`bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex gap-3 ${
                    wide ? 'flex-col sm:flex-row sm:items-center' : 'items-center'
                  }`}
                >
                  {picture && (
                    <div className={`min-w-0 ${wide ? 'w-full sm:flex-1' : 'w-[160px] flex-shrink-0'}`}>
                      <CardGrid
                        columns={picture.columns}
                        drawn={drawn}
                        highlight={picture.highlight}
                        size="sm"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 text-right">
                    <p
                      className="text-[11px] font-black text-slate-200"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      سيت {String(w.setNo).padStart(3, '0')}
                      {w.cardNo !== undefined
                        ? ` | بطاقة ${String(w.cardNo).padStart(2, '0')}`
                        : w.half
                        ? ` — ${HALF_LABELS[w.half]}`
                        : ' — السيت كله'}
                    </p>
                    <p
                      className={`text-[10px] font-black mt-0.5 ${
                        PRIZE_SCOPE[w.key] === 'set'
                          ? 'text-amber-400'
                          : PRIZE_SCOPE[w.key] === 'half'
                          ? 'text-sky-400'
                          : 'text-emerald-400'
                      }`}
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      {PRIZE_LABELS[w.key]}
                    </p>
                    <p
                      className="text-[9px] text-slate-500 font-bold mt-0.5"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      الفائز {w.place} من {w.count} · اكتملت بالرقم رقم{' '}
                      <span className="font-mono">{w.at}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* what the prizes were that night */}
      <div className="flex flex-wrap gap-1.5">
        {PRIZE_ORDER.filter((k) => detail.prizes[k].enabled).map((k) => (
          <span
            key={k}
            className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[9px] font-black text-slate-400"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {PRIZE_LABELS[k]} × {detail.prizes[k].count}
          </span>
        ))}
      </div>
    </>
  );
}
