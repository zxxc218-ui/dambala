'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Play, Pause, RotateCcw, Award, History, Sparkles, Loader2, Plus, X } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

interface DrawSession {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'finished';
  numbers: { number: number; drawOrder: number }[];
}

interface Winner {
  setNo: number;
  cardNo: number;
  winType?: string;
  row1?: boolean;
  row2?: boolean;
  row3?: boolean;
  fullCard?: boolean;
}

export default function PlayPage() {
  const [session, setSession] = useState<DrawSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Manual Draw State
  const [manualNumber, setManualNumber] = useState('');
  const [addingManual, setAddingManual] = useState(false);

  // New Winner Alerts State
  const [activeNewWinners, setActiveNewWinners] = useState<Winner[]>([]);
  
  // All Winners Report State
  const [allWinners, setAllWinners] = useState<Winner[] | null>(null);
  const [loadingAllWinners, setLoadingAllWinners] = useState(false);

  // Fetch current session on mount
  useEffect(() => {
    fetchCurrentSession();
  }, []);

  const fetchCurrentSession = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions/current');
      const data = await res.json();
      if (data.success) {
        setSession(data.session);
      }
    } catch (err) {
      console.error('Failed to fetch current session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSessionName }),
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.session);
        setNewSessionName('');
        setAllWinners(null);
        setActiveNewWinners([]);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('تعذر الاتصال بالخادم لبدء الجلسة');
    } finally {
      setCreating(false);
    }
  };

  const processDrawResult = (data: any) => {
    if (session) {
      setSession({
        ...session,
        numbers: [...session.numbers, { number: data.number, drawOrder: data.order }]
      });

      // If new winners are detected, trigger alert popup
      if (data.newWinners && data.newWinners.length > 0) {
        setActiveNewWinners(data.newWinners);
      }
    }
  };

  const handleDrawRandomNumber = async () => {
    if (!session || drawing || session.status !== 'active') return;
    setDrawing(true);
    setError('');

    try {
      const res = await fetch('/api/sessions/current/draw', {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        processDrawResult(data);
      } else {
        setError(data.message || 'حدث خطأ أثناء سحب الرقم');
      }
    } catch (err) {
      setError('فشل سحب رقم جديد، يرجى المحاولة لاحقاً');
    } finally {
      setDrawing(false);
    }
  };

  const handleAddManualNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || addingManual || session.status !== 'active') return;
    
    setError('');
    const num = parseInt(manualNumber, 10);
    if (isNaN(num) || num < 1 || num > 90) {
      setError('يرجى إدخال رقم صحيح بين 1 و 90');
      return;
    }

    setAddingManual(true);

    try {
      const res = await fetch('/api/sessions/current/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: num })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        processDrawResult(data);
        setManualNumber(''); // Reset field
      } else {
        setError(data.message || 'حدث خطأ أثناء إضافة الرقم يدوياً');
      }
    } catch (err) {
      setError('تعذر إضافة الرقم يدوياً للسيرفر');
    } finally {
      setAddingManual(false);
    }
  };

  const handleNumberClick = async (num: number) => {
    if (!session || drawing || addingManual) return;
    if (session.status !== 'active') {
      alert('يرجى استئناف اللعب أولاً لسحب الأرقام');
      return;
    }

    if (drawnNumbers.includes(num)) {
      return;
    }

    setDrawing(true);
    setError('');

    try {
      const res = await fetch('/api/sessions/current/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: num })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        processDrawResult(data);
      } else {
        setError(data.message || 'حدث خطأ أثناء سحب الرقم');
      }
    } catch (err) {
      setError('تعذر الاتصال بالسيرفر لسحب الرقم');
    } finally {
      setDrawing(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!session) return;
    const targetStatus = session.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch('/api/sessions/current/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus })
      });
      const data = await res.json();
      if (data.success) {
        setSession(prev => {
          if (!prev) return null;
          return { ...prev, status: targetStatus };
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetSession = async () => {
    if (!session) return;
    const confirmed = window.confirm(
      'تحذير هام: هل أنت متأكد من مسح جميع الأرقام المسحوبة الحالية وإعادة ضبط الجلسة للبدء من جديد؟ لا يمكن استرجاع الأرقام المحذوفة.'
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/sessions/current/reset', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setSession(prev => {
          if (!prev) return null;
          return { ...prev, numbers: [], status: 'active' };
        });
        setAllWinners(null);
        setActiveNewWinners([]);
        setError('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFinishSession = async () => {
    if (!session) return;
    const confirmed = window.confirm('هل تريد إنهاء هذه الجلسة وإغلاقها نهائياً؟');
    if (!confirmed) return;

    try {
      const res = await fetch('/api/sessions/current/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'finished' })
      });
      const data = await res.json();
      if (data.success) {
        setSession(null);
        setAllWinners(null);
        setActiveNewWinners([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckAllWinners = async () => {
    if (!session) return;
    setLoadingAllWinners(true);
    setAllWinners(null);
    try {
      const res = await fetch('/api/sessions/current/winners');
      const data = await res.json();
      if (data.success) {
        setAllWinners(data.winners);
      } else {
        alert(data.message || 'فشل فحص الفائزين');
      }
    } catch (err) {
      alert('تعذر الاتصال بالسيرفر لفحص البطاقات');
    } finally {
      setLoadingAllWinners(false);
    }
  };

  // Helper values
  const drawnNumbers = session?.numbers.map(n => n.number) || [];
  const latestDraw = session && session.numbers.length > 0
    ? session.numbers[session.numbers.length - 1].number
    : null;
  const previousDraw = session && session.numbers.length > 1
    ? session.numbers[session.numbers.length - 2].number
    : null;

  const formatSetNo = (no: number) => String(no).padStart(3, '0');
  const formatCardNo = (no: number) => String(no).padStart(2, '0');

  return (
    <ProtectedRoute allowedRoles={['admin', 'caller']}>
      <Navbar />
      <div className="container max-w-[1200px] mx-auto px-4 py-6 md:py-10 pb-24">
        
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-500 font-bold">
            <Loader2 className="animate-spin text-emerald-500" size={24} />
            <span style={{ fontFamily: 'Cairo, sans-serif' }}>جاري تحميل بيانات اللعبة...</span>
          </div>
        ) : !session ? (
          /* NO ACTIVE SESSION */
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-w-xl mx-auto p-8 md:p-10 animate-[popIn_0.3s_ease-out]">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white" style={{ fontFamily: 'Cairo, sans-serif' }}>بدء جلسة سحب جديدة</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                للبدء بسحب الأرقام ومراقبة الفائزين، يرجى تشغيل الجلسة أولاً.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400 p-3 rounded-lg text-sm mb-5 font-bold text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleStartSession} className="flex flex-col gap-6">
              <div>
                <label htmlFor="session-name" className="block text-slate-700 dark:text-slate-300 font-bold text-sm mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  اسم الجلسة (اختياري)
                </label>
                <input
                  type="text"
                  id="session-name"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="مثال: سحب ديوان الجمعية"
                  className="input-field w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:border-emerald-500 transition-colors"
                  disabled={creating}
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-emerald-500 hover:bg-emerald-600 active:translate-y-[1px] text-white font-extrabold py-3.5 px-6 rounded-lg text-base transition-all shadow-lg shadow-emerald-500/20 flex justify-center items-center gap-2" 
                disabled={creating}
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {creating ? 'جاري تهيئة الجلسة...' : 'ابدأ جلسة السحب الآن 🎲'}
              </button>
            </form>
          </div>
        ) : (
          /* PLAY SESSION RUNNING */
          <div>
            
            {/* Top Control Header Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md p-5 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-center md:text-right">
                <span className="text-xs text-slate-400 font-bold block" style={{ fontFamily: 'Cairo, sans-serif' }}>جلسة السحب واللعب الحالية</span>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-white mt-1" style={{ fontFamily: 'Cairo, sans-serif' }}>{session.name}</h2>
              </div>

              <div className="flex flex-wrap gap-2 justify-center items-center">
                <button
                  onClick={handleCheckAllWinners}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold border border-blue-200 hover:bg-blue-50 text-blue-500 dark:border-blue-900 dark:hover:bg-blue-950/20 rounded-lg transition-colors"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  <Award size={14} /> فحص كل الفائزين
                </button>

                <div className={`px-3 py-1.5 rounded-full font-bold text-xs ${
                  session.status === 'active' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400'
                }`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                  {session.status === 'active' ? 'نشط' : 'متوقف مؤقتا'}
                </div>

                <button 
                  onClick={handleToggleStatus} 
                  className="flex items-center gap-1 px-4 py-2 text-xs font-bold border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {session.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                  <span className="mr-1">{session.status === 'active' ? 'إيقاف مؤقت' : 'استئناف'}</span>
                </button>

                <button 
                  onClick={handleResetSession} 
                  className="flex items-center gap-1 px-4 py-2 text-xs font-bold border border-red-200 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-950/10 text-red-500 rounded-lg transition-colors"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  <RotateCcw size={14} /> إعادة الجلسة
                </button>

                <button 
                  onClick={handleFinishSession} 
                  className="px-4 py-2 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  إنهاء اللعبة
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400 p-3 rounded-lg text-sm mb-6 font-bold text-center">
                {error}
              </div>
            )}

            {/* Main responsive grid: 1 col on mobile, 3 cols on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Scoreboard of 1-90 (hidden on mobile, shown on desktop md/lg) */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md p-6 lg:col-span-2 hidden md:block">
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white mb-5 flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  <span>📋</span> لوحة الأرقام المكتملة (1 إلى 90)
                </h3>

                <div className="grid grid-cols-10 gap-2.5" style={{ direction: 'ltr' }}>
                  {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => {
                    const isDrawn = drawnNumbers.includes(n);
                    const isLatest = latestDraw === n;

                    return (
                      <button
                        key={n}
                        onClick={() => handleNumberClick(n)}
                        className={`aspect-square rounded-lg flex items-center justify-center text-lg font-black transition-all ${
                          isLatest 
                            ? 'bg-amber-400 text-slate-900 border-2 border-slate-800 shadow-[0_0_12px_rgba(251,191,36,0.5)] scale-105' 
                            : isDrawn 
                            ? 'bg-emerald-500 text-white cursor-default' 
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-500 dark:bg-slate-900 dark:hover:bg-slate-950/50'
                        }`}
                        disabled={isDrawn}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-5 mt-6 text-xs font-semibold justify-center" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-emerald-500"></div>
                    <span>مسحوبة ({drawnNumbers.length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-amber-400"></div>
                    <span>آخر رقم مسحوب</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-900"></div>
                    <span>متبقية ({90 - drawnNumbers.length})</span>
                  </div>
                </div>
              </div>

              {/* Side/Mobile Panels: Sphere, Manual Draw Input, history */}
              <div className="flex flex-col gap-6 lg:col-span-1">
                
                {/* Random Draw Sphere (Responsive: larger on mobile) */}
                <div className="bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-2xl shadow-lg p-6 md:p-8 text-center relative overflow-hidden">
                  {/* Decorative background glow */}
                  <div className="absolute inset-0 bg-white/5 opacity-40 blur-3xl rounded-full"></div>
                  
                  <span className="text-sm font-extrabold text-white/80 tracking-wider block" style={{ fontFamily: 'Cairo, sans-serif' }}>الرقم الحالي المسحوب</span>
                  
                  {/* Sphere size is responsive: huge on mobile */}
                  <div className="relative w-48 h-48 md:w-40 md:h-40 rounded-full bg-white text-slate-900 flex items-center justify-center text-7xl md:text-6xl font-black mx-auto my-6 shadow-2xl border-4 border-slate-950/10">
                    {latestDraw ? latestDraw : '-'}
                  </div>

                  <div className="flex justify-around text-xs text-white/95 font-bold mb-6" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    <div>الرقم السابق: <strong>{previousDraw || '-'}</strong></div>
                    <div>ترتيب السحب: <strong>{drawnNumbers.length} / 90</strong></div>
                  </div>

                  {/* Draw button is big and bold */}
                  <button
                    onClick={handleDrawRandomNumber}
                    disabled={drawing || session.status !== 'active' || drawnNumbers.length >= 90}
                    className="w-full bg-white hover:bg-slate-50 disabled:bg-slate-100/20 disabled:text-white/40 text-emerald-600 font-extrabold py-3.5 md:py-3 px-6 rounded-xl text-base md:text-sm transition-all shadow-md active:translate-y-[1px]"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    {drawing ? 'جاري السحب...' : 'سحب رقم عشوائي 🎲'}
                  </button>
                </div>

                {/* Manual Draw Input Form */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md p-5">
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white mb-3 flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    <Plus size={16} /> إضافة رقم مسحوب يدوياً:
                  </h3>

                  <form onSubmit={handleAddManualNumber} className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={manualNumber}
                      onChange={(e) => setManualNumber(e.target.value)}
                      placeholder="رقم (1-90)"
                      className="input-field flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:border-emerald-500 transition-colors"
                      disabled={addingManual || session.status !== 'active'}
                      required
                    />
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-bold bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
                      disabled={addingManual || session.status !== 'active'}
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      {addingManual ? 'جاري...' : 'إضافة'}
                    </button>
                  </form>
                </div>

                {/* Recent Logs (Mobile: displays as inline button pills, Desktop: scrollable list) */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md p-5">
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white mb-3 flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    <History size={16} /> تاريخ السحب (تنازلي):
                  </h3>

                  {session.numbers.length === 0 ? (
                    <p className="text-slate-400 text-xs text-center py-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      لا توجد أرقام مسحوبة حالياً
                    </p>
                  ) : (
                    /* Display as small inline capsule buttons, wrapped, perfect for small screens */
                    <div className="flex flex-wrap gap-2 justify-end" style={{ direction: 'ltr' }}>
                      {[...session.numbers].reverse().map((n) => (
                        <div 
                          key={n.drawOrder} 
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5"
                        >
                          <span className="text-slate-400 text-[10px]">#{n.drawOrder}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono">{n.number}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* -------------------- 1. POPUP MODAL: NEW WINNER ALERT -------------------- */}
            {activeNewWinners.length > 0 && (
              <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
                <div className="bg-white dark:bg-slate-800 rounded-3xl border-4 border-emerald-500 shadow-2xl max-w-md w-full p-6 text-center relative animate-[popIn_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">
                  
                  <button
                    onClick={() => setActiveNewWinners([])}
                    className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={20} />
                  </button>

                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <Award size={32} />
                  </div>

                  <h2 className="text-xl md:text-2xl font-black text-emerald-500 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    🏆 يوجد فائز جديد! 🏆
                  </h2>
                  <p className="text-slate-400 text-xs mb-5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    تم اكتمال خطوط اللعب للبطاقات التالية بفعل الرقم الأخير:
                  </p>

                  <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto mb-6 text-right">
                    {activeNewWinners.map((winner, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50 rounded-xl flex justify-between items-center"
                      >
                        <span className="font-bold text-slate-800 dark:text-white text-xs md:text-sm">
                          السيت: {formatSetNo(winner.setNo)} | البطاقة: {formatCardNo(winner.cardNo)}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                          winner.winType === 'البطاقة كاملة (دمبلة)' ? 'bg-amber-400 text-slate-900' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                          {winner.winType}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => setActiveNewWinners([])} 
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3 px-6 rounded-xl transition-all"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    متابعة اللعب 🎲
                  </button>
                </div>
              </div>
            )}

            {/* -------------------- 2. POPUP MODAL: ALL WINNERS REPORT -------------------- */}
            {allWinners !== null && (
              <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto relative">
                  
                  <button
                    onClick={() => setAllWinners(null)}
                    className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={20} />
                  </button>

                  <h3 className="text-lg font-extrabold text-slate-800 dark:text-white mb-1 flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    <Award className="text-emerald-500" /> تقرير الفائزين الإجمالي بالجلسة
                  </h3>
                  <p className="text-slate-400 text-xs mb-6" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    قائمة بجميع البطاقات التي حققت فوزاً بخط واحد أو أكثر مقارنة بكامل الأرقام المسحوبة بالجلسة.
                  </p>

                  {allWinners.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      <p style={{ fontFamily: 'Cairo, sans-serif' }}>لا يوجد أي بطاقة فائزة في الجلسة حتى الآن.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-xl">
                      <table className="w-full border-collapse text-center text-xs md:text-sm">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            <th className="p-3 font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>السيت</th>
                            <th className="p-3 font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>البطاقة</th>
                            <th className="p-3 font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>الخط الأول</th>
                            <th className="p-3 font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>الخط الثاني</th>
                            <th className="p-3 font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>الخط الثالث</th>
                            <th className="p-3 font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>البطاقة كاملة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allWinners.map((winner, idx) => (
                            <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/60 text-slate-800 dark:text-slate-200">
                              <td className="p-3 font-extrabold">Set {formatSetNo(winner.setNo)}</td>
                              <td className="p-3 font-extrabold">Card {formatCardNo(winner.cardNo)}</td>
                              
                              <td className={`p-3 font-bold ${winner.row1 ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                                {winner.row1 ? '✅ فائز' : 'غير فائز'}
                              </td>
                              <td className={`p-3 font-bold ${winner.row2 ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                                {winner.row2 ? '✅ فائز' : 'غير فائز'}
                              </td>
                              <td className={`p-3 font-bold ${winner.row3 ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                                {winner.row3 ? '✅ فائز' : 'غير فائز'}
                              </td>
                              <td className={`p-3 font-black ${winner.fullCard ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                                {winner.fullCard ? '🏆 دمبلة' : 'غير فائزة'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <button 
                      onClick={() => setAllWinners(null)} 
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-lg text-sm"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      إغلاق التقرير
                    </button>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </ProtectedRoute>
  );
}
