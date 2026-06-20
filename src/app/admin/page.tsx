'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { LayoutGrid, AlertCircle, Save, Trash2, Loader2, CheckCircle2, AlertTriangle, ChevronRight, ChevronLeft, Upload } from 'lucide-react';
import Link from 'next/link';
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
  const [selectedSetNo, setSelectedSetNo] = useState<number>(1);
  const [activeCardNo, setActiveCardNo] = useState<number>(1);
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

  useEffect(() => {
    if (selectedSetNo) {
      handleLoadSet(selectedSetNo);
    }
  }, [selectedSetNo]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setIsAdmin(data.authenticated && data.user?.role === 'admin');
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

  const handleLoadSet = async (setNo: number) => {
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
        updateCardState(cardNo, { successMessage: 'تم حفظ الكرت بنجاح! 💾' });
        
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
    if (!dbSet) return { text: 'فارغ', color: 'text-slate-500 bg-slate-900 border-slate-800' };
    if (dbSet.isValid) return { text: 'سليم ✅', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    return { text: 'تنبيه ⚠️', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  };

  const navigateSet = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      setSelectedSetNo(prev => (prev < 150 ? prev + 1 : 1));
    } else {
      setSelectedSetNo(prev => (prev > 1 ? prev - 1 : 150));
    }
  };

  const formatSetNo = (no: number) => String(no).padStart(3, '0');
  const formatCardNo = (no: number) => String(no).padStart(2, '0');

  const activeCard = setDetails?.cards.find(c => c.cardNo === activeCardNo);

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Navbar />
      <div className="w-full px-4 py-5 flex flex-col gap-5 select-none pb-24">
        
        {/* Title Section */}
        <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
          <div className="flex items-center gap-2 text-slate-100">
            <LayoutGrid className="text-emerald-400" size={20} />
            <h1 className="text-sm font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>إدارة وتعديل السيتات</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/import" className="flex items-center gap-1 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[10px] py-1.5 px-3 rounded-lg transition-all">
              <Upload size={12} />
              <span>استيراد</span>
            </Link>
            {dbSets.length > 0 && (
              <button 
                onClick={handleDeleteAll} 
                disabled={deletingAll}
                className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold text-[10px] py-1.5 px-3 rounded-lg transition-all cursor-pointer"
              >
                <Trash2 size={12} />
                <span>حذف الكل</span>
              </button>
            )}
          </div>
        </div>

        {/* Database Schema Warning */}
        {isSchemaMissing && (
          <div className="bg-red-500/10 border border-red-500/25 text-red-400 p-4 rounded-2xl flex flex-col gap-2 text-right">
            <h2 className="text-sm font-black flex items-center gap-1.5 mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
              <AlertCircle size={18} className="flex-shrink-0" /> جداول قاعدة البيانات غير موجودة!
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
              لم نتمكن من العثور على الجداول المطلوبة في Supabase. يرجى تشغيل كود الـ SQL التالي في SQL Editor بلوحة Supabase لتنشيط قاعدة البيانات.
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`create table sets (id uuid default gen_random_uuid() primary key, set_no integer unique not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null); create table cards (id uuid default gen_random_uuid() primary key, set_id uuid references sets(id) on delete cascade not null, card_no integer not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null, unique(set_id, card_no)); create table card_rows (id uuid default gen_random_uuid() primary key, card_id uuid references cards(id) on delete cascade not null, row_no integer not null, c1 integer, c2 integer, c3 integer, c4 integer, c5 integer, c6 integer, c7 integer, c8 integer, c9 integer, unique(card_id, row_no)); create table draw_sessions (id uuid default gen_random_uuid() primary key, name text not null, started_at timestamp with time zone default timezone('utc'::text, now()) not null, ended_at timestamp with time zone, status text not null); create table draw_numbers (id uuid default gen_random_uuid() primary key, session_id uuid references draw_sessions(id) on delete cascade not null, number integer not null, draw_order integer not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null, unique(session_id, number));`);
                alert('تم نسخ الكود! 📋');
              }}
              className="mt-2 bg-slate-950 border border-slate-800 text-slate-300 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              نسخ كود SQL
            </button>
          </div>
        )}

        {/* Set Selector Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-md items-center">
          <span className="text-[11px] font-bold text-slate-400" style={{ fontFamily: 'Cairo, sans-serif' }}>اختر رقم السيت (1 - 150)</span>
          
          <div className="flex items-center gap-3 w-full justify-center">
            <button 
              onClick={() => navigateSet('prev')} 
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-emerald-400 active:scale-90 transition-all cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>

            <div className="relative">
              <input
                type="number"
                min="1"
                max="150"
                value={selectedSetNo}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 150) {
                    setSelectedSetNo(val);
                  }
                }}
                className="w-24 text-center py-2 text-base font-black bg-slate-950 border border-slate-800 text-slate-100 rounded-xl outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <button 
              onClick={() => navigateSet('next')} 
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-emerald-400 active:scale-90 transition-all cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
          </div>

          {/* Active Set Status badge */}
          <div className={`px-3 py-1 rounded-full border text-[10px] font-black ${getSetStatusSymbol(selectedSetNo).color}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
            حالة السيت: {getSetStatusSymbol(selectedSetNo).text}
          </div>
        </div>

        {/* Editor Area */}
        {loadingDetails ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500 font-bold">
            <Loader2 className="animate-spin text-emerald-500" size={24} />
            <span className="text-xs" style={{ fontFamily: 'Cairo, sans-serif' }}>جاري تحميل أرقام السيت {formatSetNo(selectedSetNo)}...</span>
          </div>
        ) : setDetails ? (
          <div className="flex flex-col gap-4">
            
            {/* Card selector horizontal tabs */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 flex justify-between gap-1 shadow-md">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    setActiveCardNo(num);
                    setSetValidationErrors([]);
                    setSetValidationSuccess('');
                  }}
                  className={`flex-1 text-center py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeCardNo === num
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/10'
                      : 'text-slate-400 bg-slate-950/40 border border-slate-950/20 hover:text-slate-200'
                  }`}
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  كرت {num}
                </button>
              ))}
            </div>

            {/* Set Validation Alerts */}
            {setValidationSuccess && (
              <div className="bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs font-bold flex items-center gap-2 justify-center">
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span style={{ fontFamily: 'Cairo, sans-serif' }}>{setValidationSuccess}</span>
              </div>
            )}

            {setValidationErrors.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3.5 rounded-xl text-right">
                <h4 className="font-extrabold flex items-center gap-1.5 mb-1.5 text-xs" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  <AlertTriangle size={16} className="flex-shrink-0" /> تنبيهات تدقيق السيت:
                </h4>
                <ul className="list-disc pr-4 text-[10px] text-slate-300 leading-normal flex flex-col gap-1">
                  {setValidationErrors.map((err, idx) => (
                    <li key={idx} style={{ fontFamily: 'Cairo, sans-serif' }}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Selected Card Form Details */}
            {activeCard && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col gap-4 shadow-xl">
                
                {/* Active Card Label */}
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-xs font-black text-slate-200">
                    السيت {formatSetNo(selectedSetNo)} - البطاقة {formatCardNo(activeCardNo)}
                  </span>
                  
                  <button
                    onClick={() => handleSaveCard(activeCardNo)}
                    className="flex items-center gap-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-[10px] font-black cursor-pointer transition-all active:scale-95"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    <Save size={12} />
                    <span>حفظ هذا الكرت</span>
                  </button>
                </div>

                {/* Card Messages */}
                {activeCard.successMessage && (
                  <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 py-2 px-3 rounded-lg text-xs font-bold text-center">
                    {activeCard.successMessage}
                  </div>
                )}

                {activeCard.validationErrors && (
                  <div className="bg-red-500/10 border border-red-500/25 text-red-400 p-3 rounded-lg text-xs">
                    <ul className="list-disc pr-4 text-[10px] text-red-300 leading-normal flex flex-col gap-0.5">
                      {activeCard.validationErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 3x9 Grid Inputs */}
                <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl flex flex-col gap-1.5">
                  {activeCard.rows.map((row) => (
                    <div key={row.rowNo} className="grid grid-cols-9 gap-1.5" style={{ direction: 'ltr' }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((cIdx) => {
                        const colKey = `c${cIdx}` as keyof CardRow;
                        const val = row[colKey];

                        return (
                          <div key={cIdx} className="aspect-square w-full">
                            <input
                              type="text"
                              value={val === null ? '' : String(val)}
                              onChange={(e) => handleCellChange(activeCardNo, row.rowNo, colKey, e.target.value)}
                              placeholder=""
                              className={`w-full h-full text-center font-black text-base outline-none rounded transition-colors ${
                                val === null 
                                  ? 'bg-slate-900 border border-slate-850 text-slate-600 focus:border-emerald-500/50' 
                                  : 'bg-slate-800 border border-slate-700 text-slate-100 focus:border-emerald-500'
                              }`}
                              disabled={!isAdmin}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Info Text */}
                <span className="text-[9px] text-slate-500 text-center leading-normal" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  الأعمدة مرتبة من اليسار لليمين حسب العشرات: (1-9)، (10-19)، (20-29)، إلخ.
                </span>

              </div>
            )}

            {/* Full Set Actions */}
            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={handleSaveFullSet}
                disabled={savingSet}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-3.5 px-6 rounded-2xl text-sm transition-all active:scale-[0.98] flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {savingSet ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>جاري حفظ السيت...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>حفظ السيت بالكامل (6 بطاقات)</span>
                  </>
                )}
              </button>
            </div>

          </div>
        ) : null}

      </div>
    </ProtectedRoute>
  );
}
