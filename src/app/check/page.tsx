'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Search, Award, CheckCircle2, XCircle, Info, Loader2, AlertCircle } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

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
  id: string;
  cardNo: number;
  rows: CardRow[];
}

export default function CheckWinnerPage() {
  const [setNo, setSetNo] = useState('');
  const [cardNo, setCardNo] = useState('');
  
  // Game session drawn numbers
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [sessionName, setSessionName] = useState('');
  const [loadingSession, setLoadingSession] = useState(true);

  // Search results
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [cardData, setCardData] = useState<Card | null>(null);
  const [error, setError] = useState('');

  // Load current session drawn numbers on mount
  useEffect(() => {
    fetchCurrentSession();
  }, []);

  const fetchCurrentSession = async () => {
    setLoadingSession(true);
    try {
      const res = await fetch('/api/sessions/current');
      const data = await res.json();
      if (data.success && data.session) {
        setDrawnNumbers(data.session.numbers.map((n: any) => n.number));
        setSessionName(data.session.name);
      } else {
        setSessionName('لا توجد جلسة لعب نشطة حالياً');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleSearchCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCardData(null);
    setSearched(false);

    const parsedSetNo = parseInt(setNo, 10);
    const parsedCardNo = parseInt(cardNo, 10);

    if (isNaN(parsedSetNo) || isNaN(parsedCardNo)) {
      setError('يرجى إدخال أرقام صالحة للسيت والبطاقة');
      return;
    }

    setSearching(true);

    try {
      // Re-fetch current session in case new numbers were drawn
      const sessionRes = await fetch('/api/sessions/current');
      const sessionData = await sessionRes.json();
      if (sessionData.success && sessionData.session) {
        setDrawnNumbers(sessionData.session.numbers.map((n: any) => n.number));
        setSessionName(sessionData.session.name);
      }

      // Fetch set details
      const res = await fetch(`/api/sets/${parsedSetNo}`);
      const data = await res.json();

      if (res.ok && data.success) {
        const foundCard = data.set.cards.find((c: any) => c.cardNo === parsedCardNo);
        if (foundCard) {
          setCardData(foundCard);
          setSearched(true);
        } else {
          setError(`البطاقة رقم ${parsedCardNo} غير موجودة في السيت ${parsedSetNo}`);
        }
      } else {
        setError(data.message || 'فشل جلب تفاصيل السيت');
      }
    } catch (err) {
      setError('تعذر الاتصال بالخادم، يرجى التحقق من الشبكة');
    } finally {
      setSearching(false);
    }
  };

  // Helper to get row status (Check if row numbers are drawn, and get missing numbers)
  const getRowStatus = (row: CardRow) => {
    const rowNumbers: number[] = [];
    const missingNumbers: number[] = [];
    
    [row.c1, row.c2, row.c3, row.c4, row.c5, row.c6, row.c7, row.c8, row.c9].forEach(val => {
      if (val !== null) {
        rowNumbers.push(val);
        if (!drawnNumbers.includes(val)) {
          missingNumbers.push(val);
        }
      }
    });

    const isComplete = missingNumbers.length === 0;

    return {
      isComplete,
      missingNumbers,
      totalCount: rowNumbers.length
    };
  };

  const getCardStatus = (card: Card) => {
    const cardNumbers: number[] = [];
    const missingNumbers: number[] = [];

    card.rows.forEach(row => {
      [row.c1, row.c2, row.c3, row.c4, row.c5, row.c6, row.c7, row.c8, row.c9].forEach(val => {
        if (val !== null) {
          cardNumbers.push(val);
          if (!drawnNumbers.includes(val)) {
            missingNumbers.push(val);
          }
        }
      });
    });

    const isComplete = missingNumbers.length === 0;

    return {
      isComplete,
      missingNumbers,
      totalCount: cardNumbers.length
    };
  };

  // Status variables if card found
  const row1Status = cardData ? getRowStatus(cardData.rows.find(r => r.rowNo === 1)!) : null;
  const row2Status = cardData ? getRowStatus(cardData.rows.find(r => r.rowNo === 2)!) : null;
  const row3Status = cardData ? getRowStatus(cardData.rows.find(r => r.rowNo === 3)!) : null;
  const cardStatus = cardData ? getCardStatus(cardData) : null;

  const formatSetNo = (no: string | number) => String(no).padStart(3, '0');
  const formatCardNo = (no: string | number) => String(no).padStart(2, '0');

  return (
    <ProtectedRoute allowedRoles={['admin', 'checker']}>
      <Navbar />
      <div className="w-full px-4 py-5 flex flex-col gap-5 select-none pb-24">
        
        {/* Title */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
          <div className="flex items-center gap-2 text-slate-100">
            <Award className="text-emerald-400" size={20} />
            <h1 className="text-sm font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>فحص وتدقيق بطاقة الفائز</h1>
          </div>
          <p className="text-[10px] text-slate-400 mt-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
            أدخل رقم السيت والبطاقة للتحقق من الفوز بخط أو بالدمبلة.
          </p>
        </div>

        {/* Current Session status */}
        <div className="bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl flex flex-col gap-1 text-right">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Info size={14} className="flex-shrink-0" />
            <span style={{ fontFamily: 'Cairo, sans-serif' }}>جلسة السحب: {sessionName}</span>
          </div>
          <span className="text-[10px] text-slate-350" style={{ fontFamily: 'Cairo, sans-serif' }}>
            عدد الأرقام المسحوبة بالجلسة: {drawnNumbers.length} رقم
          </span>
        </div>

        {/* Search Inputs Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-md flex flex-col gap-4">
          <h3 className="text-xs font-black text-slate-200" style={{ fontFamily: 'Cairo, sans-serif' }}>بيانات بطاقة التدقيق</h3>

          <form onSubmit={handleSearchCard} className="flex flex-col gap-4 text-right">
            <div>
              <label htmlFor="set-number-input" className="block text-slate-300 font-bold text-xs mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                رقم السيت (1 - 150)
              </label>
              <input
                type="number"
                id="set-number-input"
                min="1"
                max="150"
                value={setNo}
                onChange={(e) => setSetNo(e.target.value)}
                placeholder="مثال: 12"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 transition-colors text-sm"
                disabled={searching}
              />
            </div>

            <div>
              <label htmlFor="card-number-input" className="block text-slate-300 font-bold text-xs mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                رقم البطاقة (1 - 6)
              </label>
              <input
                type="number"
                id="card-number-input"
                min="1"
                max="6"
                value={cardNo}
                onChange={(e) => setCardNo(e.target.value)}
                placeholder="مثال: 4"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 transition-colors text-sm"
                disabled={searching}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-3 rounded-xl text-xs transition-all active:scale-[0.98] flex justify-center items-center gap-1.5 shadow-lg shadow-emerald-500/10 cursor-pointer"
              disabled={searching}
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {searching ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>جاري فحص الكرت...</span>
                </>
              ) : (
                <>
                  <Search size={14} />
                  <span>فحص البطاقة وتلوينها</span>
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-400 p-3 rounded-xl text-xs font-bold flex items-start gap-1.5">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span style={{ fontFamily: 'Cairo, sans-serif' }}>{error}</span>
            </div>
          )}
        </div>

        {/* Results Area */}
        {!searched ? (
          <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl text-center py-14 px-4 flex flex-col items-center gap-3">
            <Search size={36} className="text-slate-650 opacity-40" />
            <h3 className="text-xs text-slate-500" style={{ fontFamily: 'Cairo, sans-serif' }}>أدخل البيانات واضغط على زر الفحص للتحقق</h3>
          </div>
        ) : cardData && row1Status && row2Status && row3Status && cardStatus ? (
          <div className="flex flex-col gap-4">
            
            {/* Visual Card Grid Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-md flex flex-col gap-3">
              <h3 className="text-xs font-black text-slate-200" style={{ fontFamily: 'Cairo, sans-serif' }}>معاينة البطاقة ملونة</h3>
              
              <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl flex flex-col gap-1.5">
                <div className="flex justify-between items-center border-b border-slate-850 pb-1.5 mb-1 text-[10px] font-bold text-slate-400" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  <span>سيت {formatSetNo(setNo)}</span>
                  <span>الكرت {formatCardNo(cardNo)}</span>
                </div>

                {cardData.rows.map((row) => (
                  <div key={row.rowNo} className="grid grid-cols-9 gap-1" style={{ direction: 'ltr' }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((cIdx) => {
                      const val = row[`c${cIdx}` as keyof CardRow];
                      const isDrawn = val !== null && drawnNumbers.includes(val);

                      return (
                        <div
                          key={cIdx}
                          className={`aspect-square w-full rounded flex items-center justify-center text-xs font-black select-none ${
                            val === null 
                              ? 'bg-slate-900/40 text-transparent border border-slate-900' 
                              : isDrawn 
                              ? 'bg-emerald-500 text-slate-950 border border-emerald-600 font-extrabold shadow-sm' 
                              : 'bg-slate-800 border border-slate-700 text-slate-400'
                          }`}
                        >
                          {val !== null ? val : ''}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="flex justify-center gap-4 text-[9px] font-bold text-slate-500 mt-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded bg-emerald-500"></div>
                  <span>رقم مسحوب</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded bg-slate-850 border border-slate-700"></div>
                  <span>رقم متبقي</span>
                </div>
              </div>
            </div>

            {/* Winner Report Cards */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-md flex flex-col gap-3">
              <h3 className="text-xs font-black text-slate-200 border-b border-slate-850 pb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                نتائج فحص الخطوط والدمبلة
              </h3>

              <div className="flex flex-col gap-2">
                
                {/* Row 1 Status Card */}
                <div className="flex flex-col gap-1.5 p-3 bg-slate-950 border border-slate-850 rounded-xl text-right">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-200" style={{ fontFamily: 'Cairo, sans-serif' }}>السطر الأول (Row 1)</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                      row1Status.isComplete 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-slate-900 text-slate-500 border-slate-800/80'
                    }`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {row1Status.isComplete ? 'فائز ✅' : 'غير فائز'}
                    </span>
                  </div>
                  {!row1Status.isComplete && (
                    <div className="text-[10px] text-slate-450 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      الأرقام الناقصة: <span className="font-bold text-red-400 font-mono tracking-wide">{row1Status.missingNumbers.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Row 2 Status Card */}
                <div className="flex flex-col gap-1.5 p-3 bg-slate-950 border border-slate-850 rounded-xl text-right">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-200" style={{ fontFamily: 'Cairo, sans-serif' }}>السطر الثاني (Row 2)</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                      row2Status.isComplete 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-slate-900 text-slate-500 border-slate-800/80'
                    }`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {row2Status.isComplete ? 'فائز ✅' : 'غير فائز'}
                    </span>
                  </div>
                  {!row2Status.isComplete && (
                    <div className="text-[10px] text-slate-450 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      الأرقام الناقصة: <span className="font-bold text-red-400 font-mono tracking-wide">{row2Status.missingNumbers.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Row 3 Status Card */}
                <div className="flex flex-col gap-1.5 p-3 bg-slate-950 border border-slate-850 rounded-xl text-right">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-200" style={{ fontFamily: 'Cairo, sans-serif' }}>السطر الثالث (Row 3)</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                      row3Status.isComplete 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-slate-900 text-slate-500 border-slate-800/80'
                    }`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {row3Status.isComplete ? 'فائز ✅' : 'غير فائز'}
                    </span>
                  </div>
                  {!row3Status.isComplete && (
                    <div className="text-[10px] text-slate-450 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      الأرقام الناقصة: <span className="font-bold text-red-400 font-mono tracking-wide">{row3Status.missingNumbers.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Full Card / Tambola Status Card */}
                <div className={`flex flex-col gap-1.5 p-4 rounded-2xl border text-right mt-1.5 ${
                  cardStatus.isComplete 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-md' 
                    : 'bg-red-500/5 text-slate-200 border-red-500/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>البطاقة كاملة (دمبلة - Full Card)</span>
                    <span className={`text-xs font-black px-3 py-1 rounded-xl border ${
                      cardStatus.isComplete 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {cardStatus.isComplete ? 'فائزة 🏆🎉' : 'غير فائزة ❌'}
                    </span>
                  </div>
                  {!cardStatus.isComplete && (
                    <div className="text-[10px] text-slate-400 leading-relaxed mt-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      الأرقام المتبقية للفوز بالدمبلة: <span className="font-black text-red-400 font-mono text-xs tracking-wider">{cardStatus.missingNumbers.join(', ')}</span>
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        ) : null}

      </div>
    </ProtectedRoute>
  );
}
