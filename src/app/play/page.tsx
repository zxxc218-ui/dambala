'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Play, Pause, RotateCcw, Award, History, Sparkles, Loader2, Plus, X, ListRestart } from 'lucide-react';
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
      'تحذير هام: هل أنت متأكد من مسح جميع الأرقام المسحوبة الحالية وإعادة ضبط الجلسة للبدء من جديد؟'
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
      <div className="w-full px-4 py-5 flex flex-col gap-5 select-none pb-24">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400 font-bold">
            <Loader2 className="animate-spin text-emerald-500" size={28} />
            <span className="text-xs" style={{ fontFamily: 'Cairo, sans-serif' }}>جاري تحميل بيانات اللعبة...</span>
          </div>
        ) : !session ? (
          /* NO ACTIVE SESSION */
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 text-center shadow-xl animate-[popIn_0.3s_ease-out] mt-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <Sparkles size={28} />
              </div>
              <h2 className="text-lg font-black text-slate-100" style={{ fontFamily: 'Cairo, sans-serif' }}>بدء جلسة سحب جديدة</h2>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                للبدء بسحب الأرقام ومراقبة الفائزين، يرجى تشغيل الجلسة أولاً.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs mb-5 font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleStartSession} className="flex flex-col gap-5 text-right">
              <div>
                <label htmlFor="session-name" className="block text-slate-300 font-bold text-xs mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  اسم الجلسة (اختياري)
                </label>
                <input
                  type="text"
                  id="session-name"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="مثال: سحب ديوان الجمعية"
                  className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 transition-colors text-sm"
                  disabled={creating}
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-3 px-6 rounded-xl text-sm transition-all active:scale-[0.98] flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer" 
                disabled={creating}
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {creating ? 'جاري تهيئة الجلسة...' : 'ابدأ جلسة السحب الآن 🎲'}
              </button>
            </form>
          </div>
        ) : (
          /* PLAY SESSION RUNNING */
          <div className="flex flex-col gap-4">
            
            {/* Top Control Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-md">
              <div className="flex justify-between items-start">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold block" style={{ fontFamily: 'Cairo, sans-serif' }}>جلسة السحب الحالية</span>
                  <h2 className="text-sm font-black text-slate-100 mt-0.5" style={{ fontFamily: 'Cairo, sans-serif' }}>{session.name}</h2>
                </div>
                <div className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                  session.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                  {session.status === 'active' ? 'نشط' : 'متوقف مؤقتا'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={handleCheckAllWinners}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-extrabold border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-400 bg-cyan-500/5 rounded-xl transition-all cursor-pointer"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  <Award size={13} /> فحص الفائزين
                </button>

                <button 
                  onClick={handleToggleStatus} 
                  className="flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-bold border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {session.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                  <span>{session.status === 'active' ? 'إيقاف مؤقت' : 'استئناف'}</span>
                </button>

                <button 
                  onClick={handleResetSession} 
                  className="flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-bold border border-red-500/20 hover:border-red-500/30 text-red-400 bg-red-500/5 rounded-xl transition-all cursor-pointer"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  <RotateCcw size={13} /> إعادة تصفير الجولة
                </button>

                <button 
                  onClick={handleFinishSession} 
                  className="py-2 px-3 text-[11px] font-bold bg-red-500/20 border border-red-500/30 hover:bg-red-500 hover:text-white text-red-400 rounded-xl transition-all cursor-pointer"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  إنهاء وإغلاق الجلسة
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/25 text-red-400 p-3 rounded-xl text-xs font-bold text-center">
                {error}
              </div>
            )}

            {/* Main Interactive Sphere & Draw Area */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center relative overflow-hidden flex flex-col items-center">
              
              <span className="text-[11px] font-bold text-slate-400 tracking-wider block" style={{ fontFamily: 'Cairo, sans-serif' }}>الرقم الحالي المسحوب</span>
              
              {/* Massive Sphere */}
              <div className="relative w-40 h-40 rounded-full bg-slate-950 text-slate-100 flex items-center justify-center text-6xl font-black my-5 shadow-2xl border-4 border-slate-800 shadow-emerald-500/5 animate-[popIn_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">
                {latestDraw ? (
                  <span className="text-emerald-400 font-mono tracking-tighter">{latestDraw}</span>
                ) : (
                  <span className="text-slate-700">-</span>
                )}
                {/* Glowing ring */}
                <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping opacity-30 pointer-events-none"></div>
              </div>

              <div className="flex justify-around w-full text-xs text-slate-400 font-semibold mb-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <div>الرقم السابق: <strong className="text-slate-200">{previousDraw || '-'}</strong></div>
                <div>ترتيب السحب: <strong className="text-slate-200">{drawnNumbers.length} / 90</strong></div>
              </div>

              {/* Draw button is big and bold */}
              <button
                onClick={handleDrawRandomNumber}
                disabled={drawing || session.status !== 'active' || drawnNumbers.length >= 90}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black py-4 px-6 rounded-2xl text-base transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/10 cursor-pointer"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {drawing ? 'جاري سحب رقم...' : 'سحب رقم عشوائي 🎲'}
              </button>
            </div>

            {/* Manual Draw Input Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <Plus size={14} className="text-emerald-400" /> إضافة رقم مسحوب يدوياً:
              </h3>

              <form onSubmit={handleAddManualNumber} className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  placeholder="رقم (1-90)"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                  disabled={addingManual || session.status !== 'active'}
                  required
                />
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl transition-all active:scale-95 cursor-pointer flex-shrink-0"
                  disabled={addingManual || session.status !== 'active'}
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {addingManual ? 'جاري...' : 'إضافة'}
                </button>
              </form>
            </div>

            {/* Click to Draw / 1-90 Compact Grid */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <ListRestart size={14} className="text-emerald-400" /> انقر على الرقم لتحديده مباشرة (بدون كتابة):
              </h3>

              <div className="grid grid-cols-10 gap-1" style={{ direction: 'ltr' }}>
                {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => {
                  const isDrawn = drawnNumbers.includes(n);
                  const isLatest = latestDraw === n;

                  return (
                    <button
                      key={n}
                      onClick={() => handleNumberClick(n)}
                      className={`aspect-square w-full rounded flex items-center justify-center text-[11px] font-black transition-all cursor-pointer ${
                        isLatest 
                          ? 'bg-amber-400 text-slate-950 font-extrabold ring-2 ring-amber-400/50 scale-110 z-10' 
                          : isDrawn 
                          ? 'bg-emerald-500 text-slate-950 font-extrabold pointer-events-none' 
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800/80'
                      }`}
                      disabled={isDrawn || session.status !== 'active'}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-4 mt-3.5 text-[9px] font-bold justify-center text-slate-400" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded bg-emerald-500"></div>
                  <span>مسحوب ({drawnNumbers.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded bg-amber-400"></div>
                  <span>الأخير</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded bg-slate-950 border border-slate-800"></div>
                  <span>متبقي ({90 - drawnNumbers.length})</span>
                </div>
              </div>
            </div>

            {/* Recent Logs (Mobile: displays as inline capsules) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <History size={14} className="text-emerald-400" /> سجل السحب تنازلياً:
              </h3>

              {session.numbers.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  لا توجد أرقام مسحوبة حالياً
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 justify-end" style={{ direction: 'ltr' }}>
                  {[...session.numbers].reverse().map((n) => (
                    <div 
                      key={n.drawOrder} 
                      className="px-2 py-1 bg-slate-950 border border-slate-850 rounded-lg text-[10px] font-black flex items-center gap-1"
                    >
                      <span className="text-slate-500 text-[9px]">#{n.drawOrder}</span>
                      <span className="text-emerald-400 font-mono font-extrabold">{n.number}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* -------------------- 1. POPUP MODAL: NEW WINNER ALERT -------------------- */}
        {activeNewWinners.length > 0 && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl shadow-2xl max-w-sm w-full p-5 text-center relative animate-[popIn_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">
              
              <button
                onClick={() => setActiveNewWinners([])}
                className="absolute top-4 left-4 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-500/20 animate-bounce">
                <Award size={28} />
              </div>

              <h2 className="text-lg font-black text-emerald-400 mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                🏆 يوجد فائز جديد! 🏆
              </h2>
              <p className="text-slate-400 text-[10px] mb-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
                تم اكتمال خطوط اللعب للبطاقات التالية بفعل الرقم الأخير:
              </p>

              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto mb-5 text-right">
                {activeNewWinners.map((winner, idx) => (
                  <div 
                    key={idx} 
                    className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex justify-between items-center"
                  >
                    <span className="font-bold text-slate-200 text-xs">
                      السيت: {formatSetNo(winner.setNo)} | كرت: {formatCardNo(winner.cardNo)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg font-black text-[10px] ${
                      winner.winType === 'البطاقة كاملة (دمبلة)' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {winner.winType}
                    </span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setActiveNewWinners([])} 
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-2.5 px-6 rounded-xl text-xs transition-all cursor-pointer"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                متابعة اللعب 🎲
              </button>
            </div>
          </div>
        )}

        {/* -------------------- 2. POPUP MODAL: ALL WINNERS REPORT -------------------- */}
        {allWinners !== null && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-sm w-full p-5 max-h-[80vh] overflow-y-auto relative">
              
              <button
                onClick={() => setAllWinners(null)}
                className="absolute top-4 left-4 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <h3 className="text-sm font-black text-slate-100 mb-1 flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <Award className="text-emerald-400" size={16} /> تقرير الفائزين الإجمالي بالجلسة
              </h3>
              <p className="text-slate-400 text-[10px] mb-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
                قائمة بجميع البطاقات الفائزة مقارنة بكامل الأرقام المسحوبة بالجلسة.
              </p>

              {allWinners.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  <p style={{ fontFamily: 'Cairo, sans-serif' }}>لا يوجد أي بطاقة فائزة في الجلسة حتى الآن.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {allWinners.map((winner, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-2 text-right text-xs"
                    >
                      <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                        <span className="font-extrabold text-slate-200">
                          سيت {formatSetNo(winner.setNo)} | كرت {formatCardNo(winner.cardNo)}
                        </span>
                        {winner.fullCard && (
                          <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[9px] font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>
                            🏆 دمبلة
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-1 text-[10px] font-bold text-center">
                        <div className={`p-1 rounded ${winner.row1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-900 text-slate-600'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                          السطر 1: {winner.row1 ? 'فائز' : '✖'}
                        </div>
                        <div className={`p-1 rounded ${winner.row2 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-900 text-slate-600'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                          السطر 2: {winner.row2 ? 'فائز' : '✖'}
                        </div>
                        <div className={`p-1 rounded ${winner.row3 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-900 text-slate-600'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                          السطر 3: {winner.row3 ? 'فائز' : '✖'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5">
                <button 
                  onClick={() => setAllWinners(null)} 
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-2 rounded-xl text-xs cursor-pointer"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  إغلاق التقرير
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </ProtectedRoute>
  );
}
