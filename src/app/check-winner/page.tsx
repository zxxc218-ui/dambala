'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Search, Award, CheckCircle2, XCircle, Info, Loader2, AlertCircle } from 'lucide-react';

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
    <>
      <Navbar />
      <div className="container" style={{ maxWidth: '1000px', paddingBottom: '80px' }}>
        
        {/* Title */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award style={{ color: 'var(--primary)' }} /> فحص البطاقة والتحقق من الفوز
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            أدخل رقم السيت ورقم البطاقة للتحقق فورياً مما إذا كانت البطاقة فائزة بأحد الخطوط أو فائزة بالدمبلة الكاملة.
          </p>
        </div>

        {/* Top Session Status */}
        <div className="card" style={{ padding: '12px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: 'var(--primary-light)', border: 'none', color: 'var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700' }}>
            <Info size={16} />
            <span>الجلسة الحالية المقارن معها: <strong>{sessionName}</strong></span>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700' }}>
            عدد الأرقام المسحوبة بالجلسة: {drawnNumbers.length} رقم
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '32px', alignItems: 'start' }}>
          
          {/* Left Column: Form search input */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>أدخل معلومات البطاقة</h3>

            <form onSubmit={handleSearchCard} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="set-number-input" style={{ display: 'block', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>
                  رقم السيت (1 - 150)
                </label>
                <input
                  type="number"
                  id="set-number-input"
                  min="1"
                  max="150"
                  value={setNo}
                  onChange={(e) => setSetNo(e.target.value)}
                  placeholder="مثال: 1"
                  required
                  className="input-field"
                  disabled={searching}
                />
              </div>

              <div>
                <label htmlFor="card-number-input" style={{ display: 'block', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>
                  رقم البطاقة (1 - 6)
                </label>
                <input
                  type="number"
                  id="card-number-input"
                  min="1"
                  max="6"
                  value={cardNo}
                  onChange={(e) => setCardNo(e.target.value)}
                  placeholder="مثال: 3"
                  required
                  className="input-field"
                  disabled={searching}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '8px' }}
                disabled={searching}
              >
                {searching ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> جاري البحث...
                  </>
                ) : (
                  <>
                    <Search size={16} /> فحص البطاقة
                  </>
                )}
              </button>
            </form>

            {error && (
              <div style={{
                background: 'var(--danger-light)',
                color: 'var(--danger)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                marginTop: '16px',
                fontSize: '13px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Right Column: Card view and win status details */}
          <div>
            {!searched ? (
              <div className="card" style={{ textAlign: 'center', padding: '80px 20px', borderStyle: 'dashed', background: 'transparent' }}>
                <Search size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', opacity: 0.5 }} />
                <h3 style={{ color: 'var(--text-muted)' }}>أدخل البيانات واضغط على زر الفحص لعرض البطاقة والنتائج</h3>
              </div>
            ) : cardData && row1Status && row2Status && row3Status && cardStatus ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* 1. Visual Card Grid */}
                <div className="card" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>شكل بطاقة الدمبلة</h3>
                  
                  <div className="tambola-card" style={{ maxWidth: '100%', padding: '20px' }}>
                    <div className="tambola-card-header">
                      <span style={{ fontSize: '16px', fontWeight: '800' }}>
                        Set {formatSetNo(setNo)} - Card {formatCardNo(cardNo)}
                      </span>
                    </div>

                    <div className="tambola-grid">
                      {cardData.rows.map((row) => (
                        <div key={row.rowNo} className="tambola-row">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((cIdx) => {
                            const val = row[`c${cIdx}` as keyof CardRow];
                            const isDrawn = val !== null && drawnNumbers.includes(val);

                            return (
                              <div
                                key={cIdx}
                                className={`tambola-cell ${val === null ? 'empty' : ''} ${isDrawn ? 'drawn' : ''}`}
                              >
                                {val !== null ? val : ''}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Win / Complete report details */}
                <div className="card">
                  <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    تقرير فحص الخطوط والدمبلة
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Line 1 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                      <div>
                        <h4 style={{ fontWeight: '800', fontSize: '15px' }}>الخط الأول (Row 1)</h4>
                        {!row1Status.isComplete && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            الأرقام الناقصة: <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: '700', color: 'var(--danger)' }}>{row1Status.missingNumbers.join(', ')}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                        {row1Status.isComplete ? (
                          <span style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={18} /> فائز ✅
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <XCircle size={18} /> غير فائز
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Line 2 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                      <div>
                        <h4 style={{ fontWeight: '800', fontSize: '15px' }}>الخط الثاني (Row 2)</h4>
                        {!row2Status.isComplete && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            الأرقام الناقصة: <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: '700', color: 'var(--danger)' }}>{row2Status.missingNumbers.join(', ')}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                        {row2Status.isComplete ? (
                          <span style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={18} /> فائز ✅
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <XCircle size={18} /> غير فائز
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Line 3 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                      <div>
                        <h4 style={{ fontWeight: '800', fontSize: '15px' }}>الخط الثالث (Row 3)</h4>
                        {!row3Status.isComplete && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            الأرقام الناقصة: <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: '700', color: 'var(--danger)' }}>{row3Status.missingNumbers.join(', ')}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                        {row3Status.isComplete ? (
                          <span style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={18} /> فائز ✅
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <XCircle size={18} /> غير فائز
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Full Card / Tambola */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px',
                      background: cardStatus.isComplete ? 'var(--primary-light)' : '#fff5f5',
                      border: '1px solid',
                      borderColor: cardStatus.isComplete ? 'var(--primary)' : 'rgba(238, 82, 83, 0.2)',
                      borderRadius: 'var(--radius-md)',
                      marginTop: '8px'
                    }}>
                      <div>
                        <h4 style={{ fontWeight: '800', fontSize: '16px', color: cardStatus.isComplete ? 'var(--primary)' : 'var(--text)' }}>
                          البطاقة كاملة (دمبلة - Full Card)
                        </h4>
                        {!cardStatus.isComplete && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            الأرقام المتبقية للفوز بالدمبلة: <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: '800', color: 'var(--danger)', fontSize: '14px' }}>{cardStatus.missingNumbers.join(', ')}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', fontSize: '16px' }}>
                        {cardStatus.isComplete ? (
                          <span style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={22} /> فائزة 🏆🎉
                          </span>
                        ) : (
                          <span style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <XCircle size={22} /> غير فائزة ❌
                          </span>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            ) : null}
          </div>

        </div>

      </div>
    </>
  );
}
