'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { LayoutGrid, AlertCircle, Save, Trash2, ArrowLeft, Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
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
  cardNo: number;
  rows: CardRow[];
  validationErrors?: string[];
  successMessage?: string;
}

interface SetDetails {
  setNo: number;
  cards: Card[];
}

export default function SetsAdminPage() {
  const [dbSets, setDbSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedSetNo, setSelectedSetNo] = useState<number | null>(null);
  const [isSchemaMissing, setIsSchemaMissing] = useState(false);
  
  // Active Set editing details
  const [setDetails, setSetDetails] = useState<SetDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [savingSet, setSavingSet] = useState(false);

  // Set-level validation report alerts
  const [setValidationErrors, setSetValidationErrors] = useState<string[]>([]);
  const [setValidationSuccess, setSetValidationSuccess] = useState('');

  // Delete all loading
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    fetchSets();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setIsAdmin(data.authenticated);
    } catch (err) {
      setIsAdmin(false);
    }
  };

  const fetchSets = async () => {
    setLoading(true);
    setIsSchemaMissing(false);
    try {
      const res = await fetch('/api/sets');
      const data = await res.json();
      if (data.success) {
        setDbSets(data.sets);
      } else if (data.isSchemaMissing) {
        setIsSchemaMissing(true);
      }
    } catch (err) {
      console.error('Failed to fetch sets:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to create blank cards structure
  const createBlankSet = (setNo: number): SetDetails => {
    return {
      setNo,
      cards: Array.from({ length: 6 }, (_, cIdx) => ({
        cardNo: cIdx + 1,
        rows: Array.from({ length: 3 }, (_, rIdx) => ({
          rowNo: rIdx + 1,
          c1: null, c2: null, c3: null, c4: null, c5: null, c6: null, c7: null, c8: null, c9: null
        }))
      }))
    };
  };

  const handleSelectSet = async (setNo: number) => {
    setSelectedSetNo(setNo);
    setLoadingDetails(true);
    setSetDetails(null);
    setSetValidationErrors([]);
    setSetValidationSuccess('');

    try {
      const res = await fetch(`/api/sets/${setNo}`);
      const data = await res.json();

      if (res.ok && data.success) {
        // Map db structure to our UI card structure
        const mappedCards: Card[] = data.set.cards.map((c: any) => ({
          cardNo: c.cardNo,
          rows: c.rows.map((r: any) => ({
            rowNo: r.rowNo,
            c1: r.c1, c2: r.c2, c3: r.c3, c4: r.c4, c5: r.c5, c6: r.c6, c7: r.c7, c8: r.c8, c9: r.c9
          }))
        }));
        
        setSetDetails({
          setNo: data.set.setNo,
          cards: mappedCards
        });
      } else {
        // Set doesn't exist, initialize a blank template
        setSetDetails(createBlankSet(setNo));
      }
    } catch (err) {
      // Fallback to blank on error/network issues
      setSetDetails(createBlankSet(setNo));
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCellChange = (cardNo: number, rowNo: number, colName: keyof CardRow, value: string) => {
    if (!setDetails) return;

    const val = value.trim() === '' ? null : parseInt(value, 10);
    const cleanedVal = isNaN(val as number) ? null : val;

    setSetDetails({
      ...setDetails,
      cards: setDetails.cards.map(c => {
        if (c.cardNo === cardNo) {
          return {
            ...c,
            rows: c.rows.map(r => {
              if (r.rowNo === rowNo) {
                return {
                  ...r,
                  [colName]: cleanedVal
                };
              }
              return r;
            })
          };
        }
        return c;
      })
    });
  };

  const handleSaveCard = async (cardNo: number) => {
    if (!setDetails || !selectedSetNo) return;
    
    // Clear alerts
    setSetValidationErrors([]);
    setSetValidationSuccess('');
    
    const card = setDetails.cards.find(c => c.cardNo === cardNo);
    if (!card) return;

    // Reset card messages
    updateCardState(cardNo, { validationErrors: undefined, successMessage: undefined });

    try {
      const res = await fetch(`/api/sets/${selectedSetNo}/cards/${cardNo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: card.rows }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        updateCardState(cardNo, { successMessage: 'تم حفظ البطاقة بنجاح! 💾' });
        
        // Refresh sets list in sidebar (to update checkmark status)
        fetchSets();

        // If the API returns a set validation report, update set-level alert
        if (data.validationReport) {
          if (data.validationReport.isValid) {
            setSetValidationSuccess('السيت بالكامل سليم ومطابق لشروط اللعبة 100% ✅');
          } else {
            // Set has warnings (duplicates/missing numbers)
            setSetValidationErrors(data.validationReport.errors.map((e: any) => e.message));
          }
        }
      } else {
        const errors = data.errors || [data.message || 'فشل حفظ الكرت'];
        updateCardState(cardNo, { validationErrors: errors });
      }
    } catch (err) {
      updateCardState(cardNo, { validationErrors: ['تعذر الاتصال بالسيرفر لحفظ البطاقة'] });
    }
  };

  const handleSaveFullSet = async () => {
    if (!setDetails || !selectedSetNo || savingSet) return;

    setSavingSet(true);
    setSetValidationErrors([]);
    setSetValidationSuccess('');

    // Clear all card messages
    setDetails.cards.forEach(c => {
      updateCardState(c.cardNo, { validationErrors: undefined, successMessage: undefined });
    });

    try {
      const res = await fetch(`/api/sets/${selectedSetNo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: setDetails.cards })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSetValidationSuccess('تم حفظ السيت بالكامل بنجاح في قاعدة البيانات! 🎉');
        
        // Refresh sets list
        fetchSets();

        if (data.validationReport) {
          if (data.validationReport.isValid) {
            setSetValidationSuccess('تم حفظ السيت بالكامل، وهو سليم ومطابق للشروط 100% ✅');
          } else {
            setSetValidationErrors(data.validationReport.errors.map((e: any) => e.message));
          }
        }
      } else {
        const errors = data.errors || [data.message || 'فشل حفظ السيت كامل'];
        setSetValidationErrors(errors);
      }
    } catch (err) {
      setSetValidationErrors(['تعذر الاتصال بالسيرفر لحفظ السيت']);
    } finally {
      setSavingSet(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('هل أنت متأكد من حذف جميع السيتات والبطاقات نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    setDeletingAll(true);
    try {
      const res = await fetch('/api/sets', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setDbSets([]);
        setSelectedSetNo(null);
        setSetDetails(null);
        alert(data.message);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('تعذر الاتصال بالخادم لحذف السيتات');
    } finally {
      setDeletingAll(false);
    }
  };

  // Helper to update card metadata dynamically in state
  const updateCardState = (cardNo: number, updates: Partial<Card>) => {
    setSetDetails(prev => {
      if (!prev) return null;
      return {
        ...prev,
        cards: prev.cards.map(c => {
          if (c.cardNo === cardNo) {
            return { ...c, ...updates };
          }
          return c;
        })
      };
    });
  };

  const getSetStatusSymbol = (setNo: number) => {
    const dbSet = dbSets.find(s => s.setNo === setNo);
    if (!dbSet) return { text: '⚪ فارغ', color: 'gray' };
    if (dbSet.isValid) return { text: '✅ سليم', color: 'var(--primary)' };
    return { text: '⚠️ تحذير', color: 'orange' };
  };

  const formatSetNo = (no: number) => String(no).padStart(3, '0');
  const formatCardNo = (no: number) => String(no).padStart(2, '0');

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingBottom: '80px' }}>
        
        {/* Header Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <LayoutGrid style={{ color: 'var(--primary)' }} /> لوحة الإدخال وإدارة السيتات
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              اختر رقم سيت من القائمة (1-150) لإدخال أو تعديل أرقام البطاقات يدوياً في كرت دمبلة 3×9.
            </p>
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <Link href="/admin/import" className="btn btn-outline">
                استيراد من ملف
              </Link>
              {dbSets.length > 0 && (
                <button onClick={handleDeleteAll} className="btn btn-danger" disabled={deletingAll} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trash2 size={16} /> حذف الكل
                </button>
              )}
            </div>
          )}
        </div>

        {isSchemaMissing && (
          <div style={{
            background: '#ffebec',
            color: '#ee5253',
            border: '2px solid #ee5253',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '32px',
            direction: 'rtl'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertCircle size={24} style={{ flexShrink: 0 }} /> جداول قاعدة البيانات غير موجودة في Supabase!
            </h2>
            <p style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
              لم نتمكن من العثور على الجداول المطلوبة لتشغيل اللعبة في حساب Supabase الخاص بك. يرجى نسخ كود الـ SQL التالي وتشغيله داخل <strong>SQL Editor</strong> في لوحة تحكم Supabase لتنشيط قاعدة البيانات، ثم قم بتحديث هذه الصفحة.
            </p>
            <div style={{ position: 'relative' }}>
              <pre style={{
                background: '#2f3542',
                color: '#f1f2f6',
                padding: '16px',
                borderRadius: '8px',
                fontSize: '13px',
                overflowX: 'auto',
                direction: 'ltr',
                textAlign: 'left',
                fontFamily: 'Consolas, Monaco, monospace',
                maxHeight: '300px'
              }}>
{`-- 1. جدول السيتات (sets)
create table sets (
  id uuid default gen_random_uuid() primary key,
  set_no integer unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. جدول البطاقات (cards)
create table cards (
  id uuid default gen_random_uuid() primary key,
  set_id uuid references sets(id) on delete cascade not null,
  card_no integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(set_id, card_no)
);

-- 3. جدول أسطر البطاقة (card_rows)
create table card_rows (
  id uuid default gen_random_uuid() primary key,
  card_id uuid references cards(id) on delete cascade not null,
  row_no integer not null,
  c1 integer, c2 integer, c3 integer, c4 integer, c5 integer, c6 integer, c7 integer, c8 integer, c9 integer,
  unique(card_id, row_no)
);

-- 4. جدول جلسات اللعب (draw_sessions)
create table draw_sessions (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone,
  status text not null
);

-- 5. جدول الأرقام المسحوبة (draw_numbers)
create table draw_numbers (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references draw_sessions(id) on delete cascade not null,
  number integer not null,
  draw_order integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(session_id, number)
);`}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`-- 1. جدول السيتات (sets)
create table sets (
  id uuid default gen_random_uuid() primary key,
  set_no integer unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. جدول البطاقات (cards)
create table cards (
  id uuid default gen_random_uuid() primary key,
  set_id uuid references sets(id) on delete cascade not null,
  card_no integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(set_id, card_no)
);

-- 3. جدول أسطر البطاقة (card_rows)
create table card_rows (
  id uuid default gen_random_uuid() primary key,
  card_id uuid references cards(id) on delete cascade not null,
  row_no integer not null,
  c1 integer, c2 integer, c3 integer, c4 integer, c5 integer, c6 integer, c7 integer, c8 integer, c9 integer,
  unique(card_id, row_no)
);

-- 4. جدول جلسات اللعب (draw_sessions)
create table draw_sessions (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone,
  status text not null
);

-- 5. جدول الأرقام المسحوبة (draw_numbers)
create table draw_numbers (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references draw_sessions(id) on delete cascade not null,
  number integer not null,
  draw_order integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(session_id, number)
);`);
                  alert('تم نسخ كود SQL إلى الحافظة! 📋');
                }}
                className="btn btn-outline"
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.2)',
                  padding: '6px 12px',
                  fontSize: '12px'
                }}
              >
                نسخ الكود
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '32px', alignItems: 'start' }}>
          
          {/* Left Column: Complete list 1 to 150 */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-muted)' }}>
              قائمة السيتات (1 إلى 150)
            </h3>
            
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', padding: '20px 0' }}>
                <Loader2 className="animate-spin" size={16} />
                <span>جاري تحميل الحالات...</span>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
                maxHeight: 'calc(100vh - 240px)',
                overflowY: 'auto',
                padding: '8px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--card-bg)'
              }}>
                {Array.from({ length: 150 }, (_, i) => i + 1).map((no) => {
                  const status = getSetStatusSymbol(no);
                  const isSelected = selectedSetNo === no;

                  return (
                    <button
                      key={no}
                      onClick={() => handleSelectSet(no)}
                      style={{
                        padding: '10px 4px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                        background: isSelected ? 'var(--primary-light)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span style={{ fontWeight: '800', fontSize: '13px', color: isSelected ? 'var(--primary)' : 'var(--text)' }}>
                        سيت {formatSetNo(no)}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: status.color }}>
                        {status.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Cards Editor Area */}
          <div>
            {!selectedSetNo ? (
              <div className="card" style={{ textAlign: 'center', padding: '100px 20px', borderStyle: 'dashed', background: 'transparent' }}>
                <LayoutGrid size={56} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', opacity: 0.4 }} />
                <h3 style={{ color: 'var(--text-muted)' }}>يرجى اختيار رقم السيت من القائمة الجانبية لإدخال وتعديل الأرقام يدوياً</h3>
              </div>
            ) : loadingDetails ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 0', gap: '8px' }}>
                <Loader2 className="animate-spin" size={24} />
                <span>جاري تحميل بطاقات السيت {formatSetNo(selectedSetNo)}...</span>
              </div>
            ) : setDetails ? (
              <div>
                
                {/* Selected Set Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '800' }}>
                      تعديل وتعبئة السيت رقم {formatSetNo(selectedSetNo)}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                      أدخل الأرقام في أعمدتها الصحيحة (كل سطر 5 أرقام بالضبط، إجمالي 15 رقم في الكارت).
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={handleSaveFullSet}
                      disabled={savingSet}
                      className="btn btn-primary"
                      style={{ padding: '12px 24px', fontSize: '16px', background: '#3498db' }}
                    >
                      {savingSet ? (
                        <>
                          <Loader2 className="animate-spin" size={16} /> جاري حفظ السيت...
                        </>
                      ) : (
                        <>
                          <Save size={16} /> حفظ السيت بالكامل (6 بطاقات)
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Set-Level Alerts */}
                {setValidationSuccess && (
                  <div style={{
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: '700',
                    fontSize: '14px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <CheckCircle2 size={20} />
                    <span>{setValidationSuccess}</span>
                  </div>
                )}

                {setValidationErrors.length > 0 && (
                  <div style={{
                    background: '#fff3cd',
                    color: '#856404',
                    border: '1px solid #ffeeba',
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '28px'
                  }}>
                    <h4 style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '15px' }}>
                      <AlertTriangle size={20} /> تنبيهات تدقيق السيت (يرجى مراجعتها):
                    </h4>
                    <ul style={{ paddingRight: '20px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px', lineHeight: '1.6' }}>
                      {setValidationErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cards Form Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                  gap: '24px',
                  marginBottom: '32px'
                }}>
                  {setDetails.cards.map((card) => (
                    <div key={card.cardNo} className="tambola-card" style={{ padding: '16px 12px 14px' }}>
                      
                      {/* Card Header & Save Button */}
                      <div className="tambola-card-header">
                        <span style={{ fontSize: '15px', fontWeight: '800' }}>
                          Set {formatSetNo(selectedSetNo)} - Card {formatCardNo(card.cardNo)}
                        </span>

                        {isAdmin && (
                          <button
                            onClick={() => handleSaveCard(card.cardNo)}
                            className="btn btn-outline"
                            style={{
                              padding: '4px 10px',
                              fontSize: '12px',
                              borderColor: 'var(--primary)',
                              color: 'var(--primary)',
                              fontWeight: '700'
                            }}
                          >
                            <Save size={12} /> حفظ البطاقة
                          </button>
                        )}
                      </div>

                      {/* Card Specific Messages */}
                      {card.successMessage && (
                        <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', marginBottom: '10px', textAlign: 'center' }}>
                          {card.successMessage}
                        </div>
                      )}

                      {card.validationErrors && (
                        <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', marginBottom: '10px' }}>
                          <ul style={{ paddingRight: '12px', listStyleType: 'disc' }}>
                            {card.validationErrors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 3x9 Grid Inputs */}
                      <div className="tambola-grid">
                        {card.rows.map((row) => (
                          <div key={row.rowNo} className="tambola-row">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((cIdx) => {
                              const colKey = `c${cIdx}` as keyof CardRow;
                              const val = row[colKey];

                              return (
                                <div key={cIdx} className={`tambola-cell ${val === null ? 'empty' : ''}`} style={{ padding: '2px' }}>
                                  <input
                                    type="text"
                                    value={val === null ? '' : String(val)}
                                    onChange={(e) => handleCellChange(card.cardNo, row.rowNo, colKey, e.target.value)}
                                    placeholder=""
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      border: '1px solid #ced6e0',
                                      borderRadius: '2px',
                                      textAlign: 'center',
                                      fontWeight: '800',
                                      fontSize: '15px',
                                      fontFamily: 'inherit',
                                      outline: 'none',
                                      background: val === null ? '#f1f2f6' : 'white',
                                      transition: 'background-color 0.2s'
                                    }}
                                    disabled={!isAdmin}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>

                    </div>
                  ))}
                </div>

                {/* Big Bottom Save Set Button */}
                {isAdmin && (
                  <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                    <button
                      onClick={handleSaveFullSet}
                      disabled={savingSet}
                      className="btn btn-primary"
                      style={{ padding: '16px 40px', fontSize: '18px', background: '#3498db', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    >
                      {savingSet ? (
                        <>
                          <Loader2 className="animate-spin" size={20} /> جاري حفظ السيت...
                        </>
                      ) : (
                        <>
                          <Save size={20} /> حفظ السيت بالكامل (6 بطاقات)
                        </>
                      )}
                    </button>
                  </div>
                )}

              </div>
            ) : null}
          </div>

        </div>

      </div>
    </>
  );
}
