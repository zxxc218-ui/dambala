'use client';

import { useCallback, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { ChevronLeft, ChevronRight, Loader2, Printer, ScrollText, AlertTriangle } from 'lucide-react';

interface CardRow {
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

interface Card {
  cardNo: number;
  rows: CardRow[];
}

interface SetDetails {
  setNo: number;
  cards: Card[];
}

const MIN_SET = 1;
const MAX_SET = 150;
const COLUMNS: (keyof CardRow)[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'];

/**
 * On the printed booklet each card carries two numbers: the set number on the left
 * and a running card number on the right that continues across the whole booklet.
 */
function globalCardNo(setNo: number, cardNo: number) {
  return (setNo - 1) * 6 + cardNo;
}

function SheetCard({ setNo, card }: { setNo: number; card: Card }) {
  const rows = [1, 2, 3].map((rowNo) => card.rows.find((r) => r.rowNo === rowNo));

  return (
    <div className="sheet-card">
      <div className="sheet-card-nums">
        <span>{setNo}</span>
        <span>{globalCardNo(setNo, card.cardNo)}</span>
      </div>
      <table className="sheet-grid">
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {COLUMNS.map((col) => {
                const value = row ? row[col] : null;
                return <td key={col}>{value === null || value === undefined ? '' : value}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SheetPage() {
  const [setNo, setSetNo] = useState(1);
  const [setDetails, setSetDetails] = useState<SetDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Allow deep links like /sheet?set=42
  useEffect(() => {
    const fromUrl = parseInt(new URLSearchParams(window.location.search).get('set') || '', 10);
    if (!isNaN(fromUrl) && fromUrl >= MIN_SET && fromUrl <= MAX_SET) {
      setSetNo(fromUrl);
    }
  }, []);

  const loadSet = useCallback(async (no: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/sets/${no}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSetDetails(data.set);
      } else {
        setSetDetails(null);
        setError(data.message || `السيت رقم ${no} غير موجود في قاعدة البيانات`);
      }
    } catch {
      setSetDetails(null);
      setError('تعذر الاتصال بالسيرفر لجلب السيت');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSet(setNo);
  }, [setNo, loadSet]);

  const step = (delta: number) => {
    setSetNo((prev) => {
      const next = prev + delta;
      if (next < MIN_SET) return MAX_SET;
      if (next > MAX_SET) return MIN_SET;
      return next;
    });
  };

  const cards = setDetails
    ? [1, 2, 3, 4, 5, 6]
        .map((no) => setDetails.cards.find((c) => c.cardNo === no))
        .filter((c): c is Card => Boolean(c))
    : [];

  const leftColumn = cards.filter((c) => c.cardNo <= 3);
  const rightColumn = cards.filter((c) => c.cardNo > 3);

  return (
    <>
      <div className="no-print">
        <Navbar />
      </div>

      <div className="w-full px-4 py-5 flex flex-col gap-5 select-none pb-24 md:pb-10">
        {/* Title + print */}
        <div className="no-print flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
          <div className="flex items-center gap-2 text-slate-100">
            <ScrollText className="text-emerald-400" size={20} />
            <h1 className="text-sm font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>خريطة السيت</h1>
          </div>
          <button
            onClick={() => window.print()}
            disabled={!setDetails}
            className="flex items-center gap-1 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 font-bold text-[10px] py-1.5 px-3 rounded-lg transition-all cursor-pointer"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <Printer size={12} />
            <span>طباعة</span>
          </button>
        </div>

        {/* Set selector */}
        <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-md items-center">
          <span className="text-[11px] font-bold text-slate-400" style={{ fontFamily: 'Cairo, sans-serif' }}>
            اختر رقم السيت ({MIN_SET} - {MAX_SET})
          </span>

          <div className="flex items-center gap-3 w-full justify-center">
            <button
              onClick={() => step(-1)}
              aria-label="السيت السابق"
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-emerald-400 active:scale-90 transition-all cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>

            <input
              type="number"
              min={MIN_SET}
              max={MAX_SET}
              value={setNo}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= MIN_SET && val <= MAX_SET) setSetNo(val);
              }}
              className="w-24 text-center py-2 text-base font-black bg-slate-950 border border-slate-800 text-slate-100 rounded-xl outline-none focus:border-emerald-500 font-mono"
            />

            <button
              onClick={() => step(1)}
              aria-label="السيت التالي"
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-emerald-400 active:scale-90 transition-all cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>

        {/* States */}
        {loading && (
          <div className="no-print flex flex-col items-center justify-center py-16 gap-2 text-slate-500 font-bold">
            <Loader2 className="animate-spin text-emerald-500" size={24} />
            <span className="text-xs" style={{ fontFamily: 'Cairo, sans-serif' }}>
              جاري تحميل السيت {setNo}...
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="no-print bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl flex items-center gap-2.5 text-xs font-bold">
            <AlertTriangle size={18} className="flex-shrink-0" />
            <span style={{ fontFamily: 'Cairo, sans-serif' }}>{error}</span>
          </div>
        )}

        {/* The sheet itself — a copy of the printed page */}
        {!loading && setDetails && (
          <div className="sheet">
            <div className="sheet-cols">
              <div>
                <div className="sheet-col-head">
                  <div className="title">الخطوط</div>
                  <div className="subtitle">اول - وسط - اخير - افقي</div>
                </div>
                {leftColumn.map((card) => (
                  <SheetCard key={card.cardNo} setNo={setDetails.setNo} card={card} />
                ))}
              </div>

              <div>
                <div className="sheet-col-head">
                  <div className="title">الزوايا</div>
                  <div className="subtitle">السيت - نصف السيت - بطاقة</div>
                </div>
                {rightColumn.map((card) => (
                  <SheetCard key={card.cardNo} setNo={setDetails.setNo} card={card} />
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && setDetails && (
          <p
            className="no-print text-[10px] text-slate-500 text-center leading-relaxed"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            الرقم على يسار كل كرت هو رقم السيت، والرقم على اليمين هو رقم الكرت المتسلسل في الدفتر.
            الأعمدة من اليسار لليمين: (1-9)، (10-19)، (20-29) … (80-90).
          </p>
        )}
      </div>
    </>
  );
}
