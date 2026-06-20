'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Printer, Layout, RefreshCw, FileText, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

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

interface SetDetails {
  id: string;
  setNo: number;
  cards: Card[];
}

export default function PrintPage() {
  const [printMode, setPrintMode] = useState<'single' | 'all'>('single');
  const [layoutMode, setLayoutMode] = useState<'six-per-page' | 'one-per-page'>('six-per-page');
  const [selectedSetNo, setSelectedSetNo] = useState<string>('1');
  const [setsList, setSetsList] = useState<any[]>([]);
  const [allSetsData, setAllSetsData] = useState<SetDetails[]>([]);

  const [loadingSetsList, setLoadingSetsList] = useState(true);
  const [loadingPrintData, setLoadingPrintData] = useState(false);
  const [error, setError] = useState('');

  // Load sets list on mount (to populate set number selector)
  useEffect(() => {
    async function loadSets() {
      setLoadingSetsList(true);
      try {
        const res = await fetch('/api/sets');
        const data = await res.json();
        if (data.success) {
          setSetsList(data.sets);
        }
      } catch (err) {
        console.error('Failed to load sets list:', err);
      } finally {
        setLoadingSetsList(false);
      }
    }
    loadSets();
  }, []);

  // Fetch full details of sets for printing
  const handleLoadPrintData = async () => {
    setError('');
    setLoadingPrintData(true);
    setAllSetsData([]);

    try {
      if (printMode === 'single') {
        const parsedSetNo = parseInt(selectedSetNo, 10);
        if (isNaN(parsedSetNo)) {
          setError('رقم السيت المحدد غير صالح');
          setLoadingPrintData(false);
          return;
        }

        const res = await fetch(`/api/sets/${parsedSetNo}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setAllSetsData([data.set]);
        } else {
          setError(data.message || 'فشل جلب تفاصيل السيت');
        }
      } else {
        // Fetch ALL sets with details
        const res = await fetch('/api/sets/print');
        const data = await res.json();

        if (res.ok && data.success) {
          setAllSetsData(data.sets);
        } else {
          setError(data.message || 'فشل جلب تفاصيل السيتات للطباعة');
        }
      }
    } catch (err) {
      setError('تعذر الاتصال بالخادم لجلب تفاصيل الطباعة');
    } finally {
      setLoadingPrintData(false);
    }
  };

  const triggerPrint = () => {
    if (allSetsData.length === 0) {
      alert('الرجاء تحميل بيانات الطباعة أولاً بالضغط على زر "تجهيز للطباعة"');
      return;
    }
    window.print();
  };

  const formatSetNo = (no: number) => String(no).padStart(3, '0');
  const formatCardNo = (no: number) => String(no).padStart(2, '0');

  return (
    <>
      {/* Navigation and Settings panel is hidden on print using no-print class */}
      <div className="no-print">
        <Navbar />
      </div>

      <div className="container" style={{ maxWidth: '1100px', paddingBottom: '80px' }}>
        
        {/* Settings Panel (no-print) */}
        <div className="card no-print" style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Printer style={{ color: 'var(--primary)' }} /> تجهيز وطباعة بطاقات الدمبلة
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
            اختر السيتات والتوزيع المفضل للبطاقات. ستقوم هذه الشاشة بتحميل البطاقات وتنسيقها بشكل ملائم لورق A4 تماماً.
            بعد الضغط على زر <strong>"ابدأ الطباعة"</strong>، سيفتح المتصفح نافذة الطباعة الافتراضية، ويمكنك منها الحفظ كملف <strong>PDF</strong>.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            background: 'var(--bg)',
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px'
          }}>
            
            {/* 1. Print Mode Option */}
            <div>
              <label style={{ display: 'block', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>
                نطاق الطباعة
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { setPrintMode('single'); setAllSetsData([]); }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    cursor: 'pointer',
                    fontWeight: '700',
                    borderColor: printMode === 'single' ? 'var(--primary)' : 'var(--border)',
                    background: printMode === 'single' ? 'var(--primary-light)' : 'white',
                    color: printMode === 'single' ? 'var(--primary)' : 'var(--text)'
                  }}
                >
                  سيت واحد محدد
                </button>
                <button
                  onClick={() => { setPrintMode('all'); setAllSetsData([]); }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    cursor: 'pointer',
                    fontWeight: '700',
                    borderColor: printMode === 'all' ? 'var(--primary)' : 'var(--border)',
                    background: printMode === 'all' ? 'var(--primary-light)' : 'white',
                    color: printMode === 'all' ? 'var(--primary)' : 'var(--text)'
                  }}
                >
                  كل السيتات
                </button>
              </div>
            </div>

            {/* 2. Specific Set Select */}
            {printMode === 'single' && (
              <div>
                <label htmlFor="set-selector" style={{ display: 'block', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>
                  اختر رقم السيت
                </label>
                {loadingSetsList ? (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>جاري جلب القائمة...</span>
                ) : setsList.length === 0 ? (
                  <span style={{ fontSize: '13px', color: 'var(--danger)' }}>لا توجد بيانات بقاعدة البيانات</span>
                ) : (
                  <select
                    id="set-selector"
                    value={selectedSetNo}
                    onChange={(e) => { setSelectedSetNo(e.target.value); setAllSetsData([]); }}
                    className="input-field"
                    style={{ padding: '10px 12px' }}
                  >
                    {setsList.map((s) => (
                      <option key={s.id} value={s.setNo}>
                        سيت رقم {formatSetNo(s.setNo)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* 3. Layout Selection */}
            <div>
              <label style={{ display: 'block', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>
                توزيع البطاقات في الصفحة
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setLayoutMode('six-per-page')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    cursor: 'pointer',
                    fontWeight: '700',
                    borderColor: layoutMode === 'six-per-page' ? 'var(--primary)' : 'var(--border)',
                    background: layoutMode === 'six-per-page' ? 'var(--primary-light)' : 'white',
                    color: layoutMode === 'six-per-page' ? 'var(--primary)' : 'var(--text)'
                  }}
                >
                  6 بطاقات بالصفحة
                </button>
                <button
                  onClick={() => setLayoutMode('one-per-page')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    cursor: 'pointer',
                    fontWeight: '700',
                    borderColor: layoutMode === 'one-per-page' ? 'var(--primary)' : 'var(--border)',
                    background: layoutMode === 'one-per-page' ? 'var(--primary-light)' : 'white',
                    color: layoutMode === 'one-per-page' ? 'var(--primary)' : 'var(--text)'
                  }}
                >
                  بطاقة واحدة كبيرة
                </button>
              </div>
            </div>

          </div>

          {error && (
            <div style={{
              background: 'var(--danger-light)',
              color: 'var(--danger)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
              fontSize: '14px',
              fontWeight: '700'
            }}>
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={handleLoadPrintData}
              className="btn btn-outline"
              disabled={loadingPrintData || (printMode === 'single' && setsList.length === 0)}
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: '700' }}
            >
              {loadingPrintData ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> جاري التجهيز...
                </>
              ) : (
                <>
                  <RefreshCw size={16} /> تجهيز البيانات للطباعة
                </>
              )}
            </button>

            {allSetsData.length > 0 && (
              <button
                onClick={triggerPrint}
                className="btn btn-primary"
                style={{ background: '#2ecc71', color: 'white', fontWeight: '800' }}
              >
                <Printer size={16} /> ابدأ الطباعة الآن 🖨️
              </button>
            )}
          </div>

        </div>

        {/* -------------------- PRINTING LAYOUT AREA -------------------- */}
        
        {/* Helper preview message for user (no-print) */}
        {allSetsData.length > 0 && (
          <div className="card no-print" style={{ background: '#e8f4fd', color: '#1d8cf8', border: 'none', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <FileText size={20} />
            <span style={{ fontSize: '14px', fontWeight: '700' }}>
              تم تحميل البيانات بنجاح (إجمالي {allSetsData.length} سيت). انزل لأسفل الشاشة لمعاينة الصفحات قبل الطباعة.
            </span>
          </div>
        )}

        {allSetsData.length === 0 && !loadingPrintData && (
          <div className="card no-print" style={{ textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed', background: 'transparent' }}>
            <Printer size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', opacity: 0.4 }} />
            <h3 style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
              اضغط على زر "تجهيز البيانات للطباعة" أعلاه لإنشاء ومعاينة الصفحات.
            </h3>
          </div>
        )}

        {/* The actual printable area */}
        <div className="printable-content" style={{ direction: 'ltr' }}>
          
          {layoutMode === 'six-per-page' ? (
            /* Layout: 6 Cards per page */
            allSetsData.map((set) => (
              <div
                key={set.id}
                className="print-page"
                style={{
                  background: 'white',
                  border: '1px solid #ccc',
                  padding: '15mm 10mm',
                  minHeight: '296mm', // A4 dimension height (approx)
                  maxWidth: '210mm',
                  margin: '0 auto 40px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                  pageBreakAfter: 'always'
                }}
              >
                
                {/* Header Title */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '2px solid var(--primary)',
                  paddingBottom: '8px',
                  marginBottom: '16px',
                  color: '#2f3542',
                  direction: 'rtl'
                }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>لعبة الدمبلة العراقية 🎯</h3>
                  <span style={{ fontSize: '16px', fontWeight: '800' }}>السيت: {formatSetNo(set.setNo)}</span>
                </div>

                {/* 6 cards in a 2x3 Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gridTemplateRows: 'repeat(3, 1fr)',
                  gap: '15px',
                  flex: 1
                }}>
                  {set.cards.map((card) => (
                    <div
                      key={card.id}
                      className="tambola-card"
                      style={{
                        margin: 0,
                        maxWidth: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '12px',
                        border: '2px solid #2f3542'
                      }}
                    >
                      <div className="tambola-card-header" style={{ marginBottom: '4px', fontSize: '12px' }}>
                        <span>دمبلة عراقية</span>
                        <span>Set {formatSetNo(set.setNo)} - Card {formatCardNo(card.cardNo)}</span>
                      </div>

                      <div className="tambola-grid" style={{ gap: '3px', padding: '3px' }}>
                        {card.rows.map((row) => (
                          <div key={row.rowNo} className="tambola-row" style={{ gap: '3px' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((cIdx) => {
                              const val = row[`c${cIdx}` as keyof CardRow];
                              return (
                                <div
                                  key={cIdx}
                                  className={`tambola-cell ${val === null ? 'empty' : ''}`}
                                  style={{ fontSize: '16px', fontWeight: '800', aspectRatio: '1.2' }}
                                >
                                  {val !== null ? val : ''}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer text */}
                <div style={{
                  marginTop: '16px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  borderTop: '1px dashed #ccc',
                  paddingTop: '8px',
                  direction: 'rtl'
                }}>
                  تم التوليد والتوزيع تلقائياً بواسطة نظام الدمبلة العراقية.
                </div>

              </div>
            ))
          ) : (
            /* Layout: 1 Large card per page */
            allSetsData.flatMap((set) =>
              set.cards.map((card) => (
                <div
                  key={card.id}
                  className="print-page"
                  style={{
                    background: 'white',
                    border: '1px solid #ccc',
                    padding: '20mm',
                    minHeight: '296mm',
                    maxWidth: '210mm',
                    margin: '0 auto 40px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                    pageBreakAfter: 'always'
                  }}
                >
                  
                  <div
                    className="tambola-card"
                    style={{
                      maxWidth: '100%',
                      padding: '32px',
                      border: '3px solid #2f3542',
                      borderRadius: '12px'
                    }}
                  >
                    <div className="tambola-card-header" style={{ marginBottom: '16px', fontSize: '20px', paddingBottom: '10px' }}>
                      <span style={{ fontWeight: '800' }}>الدمبلة العراقية 🎯</span>
                      <span>Set {formatSetNo(set.setNo)} - Card {formatCardNo(card.cardNo)}</span>
                    </div>

                    <div className="tambola-grid" style={{ gap: '8px', padding: '8px', borderRadius: '8px' }}>
                      {card.rows.map((row) => (
                        <div key={row.rowNo} className="tambola-row" style={{ gap: '8px' }}>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((cIdx) => {
                            const val = row[`c${cIdx}` as keyof CardRow];
                            return (
                              <div
                                key={cIdx}
                                className={`tambola-cell ${val === null ? 'empty' : ''}`}
                                style={{ fontSize: '28px', fontWeight: '900', borderRadius: '4px' }}
                              >
                                {val !== null ? val : ''}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', direction: 'rtl' }}>
                      رقم السيت: {formatSetNo(set.setNo)} | رقم البطاقة: {formatCardNo(card.cardNo)} | اسم اللعبة: الدمبلة العراقية
                    </div>
                  </div>

                </div>
              ))
            )
          )}

        </div>

      </div>

      <style jsx global>{`
        /* Print layout adjustments inside Next.js styled-jsx if needed */
        @media print {
          body, html {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-page {
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            padding: 10mm !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </>
  );
}
