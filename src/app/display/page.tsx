'use client';

import { useState, useEffect } from 'react';
import { Loader2, Tv, Info } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DisplayPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSession();
    // Poll the current session status every 3 seconds
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/sessions/current');
      const data = await res.json();
      if (data.success) {
        setSession(data.session);
        setError('');
      } else {
        setError('تعذر جلب بيانات الجلسة النشطة');
      }
    } catch (err) {
      console.error('Error fetching session:', err);
      setError('خطأ في الاتصال بالخادم لمزامنة الأرقام');
    } finally {
      setLoading(false);
    }
  };

  const getDrawnNumbers = () => {
    if (!session || !session.numbers) return [];
    // session.numbers is already sorted by drawOrder ascending
    return session.numbers.map((n: any) => n.number);
  };

  const drawnList = getDrawnNumbers();
  const lastDrawn = drawnList.length > 0 ? drawnList[drawnList.length - 1] : null;
  
  // Last 10 numbers except the very last one (to show progression)
  // Or just show last 10 numbers in reverse order (newest first)
  const lastTen = [...drawnList].reverse().slice(1, 11);

  return (
    <ProtectedRoute allowedRoles={['admin', 'caller', 'viewer']}>
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 md:p-12 select-none overflow-hidden font-sans">
        
        {/* Header bar */}
        <div className="flex justify-between items-center border-b border-slate-800/60 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Tv size={28} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-wide" style={{ fontFamily: 'Cairo, sans-serif' }}>
                شاشة عرض أرقام الدمبلة
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                مزامنة تلقائية حية مع سحوبات المنادي
              </p>
            </div>
          </div>

          <div className="text-right">
            {session ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  جلسة نشطة: {session.name}
                </span>
                <div className="text-xs text-slate-500 mt-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  الأرقام المسحوبة: {drawnList.length} رقم
                </div>
              </>
            ) : error ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {error}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400" style={{ fontFamily: 'Cairo, sans-serif' }}>
                بانتظار بدء الجلسة
              </span>
            )}
          </div>
        </div>

        {/* Center: Large Last Drawn Number */}
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-emerald-500" size={56} />
              <span className="text-slate-400 font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>جاري التحميل...</span>
            </div>
          ) : lastDrawn !== null ? (
            <div className="flex flex-col items-center">
              <div className="text-slate-500 text-lg md:text-xl font-bold uppercase tracking-widest mb-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
                الرقم المسحوب الأخير
              </div>
              <div className="relative">
                {/* Glow behind */}
                <div className="absolute inset-0 bg-emerald-500/10 blur-[120px] rounded-full"></div>
                {/* Number sphere */}
                <div className="relative w-72 h-72 md:w-[420px] md:h-[420px] rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-[0_0_80px_rgba(16,172,132,0.3)] border-8 border-slate-900/80 animate-[popIn_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">
                  <span className="text-[120px] md:text-[210px] font-black text-slate-950 font-mono tracking-tighter leading-none select-none">
                    {lastDrawn}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-8 bg-slate-900/40 border border-slate-800/80 rounded-3xl max-w-xl">
              <div className="w-20 h-20 bg-slate-800/50 text-slate-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Info size={40} />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-300 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                بانتظار سحب الرقم الأول
              </h2>
              <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                عندما يقوم المنادي بسحب رقم جديد، سيظهر مباشرة على هذه الشاشة بأبعاد كبيرة ومريحة للرؤية من مسافات بعيدة.
              </p>
            </div>
          )}
        </div>

        {/* Bottom: Last 10 numbers list */}
        <div className="border-t border-slate-900 pt-8 pb-4">
          <div className="text-slate-500 text-sm font-bold mb-4 text-center md:text-right" style={{ fontFamily: 'Cairo, sans-serif' }}>
            آخر 10 أرقام مسحوبة سابقة:
          </div>

          {lastTen.length > 0 ? (
            <div className="flex flex-wrap md:flex-row-reverse justify-center md:justify-start gap-4 items-center overflow-x-auto py-2">
              {lastTen.map((num, idx) => (
                <div
                  key={idx}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center shadow-lg hover:border-emerald-500/50 transition-colors"
                >
                  <span className="text-xl md:text-2xl font-bold text-slate-300 font-mono">
                    {num}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-600 text-center py-4 text-sm font-medium" style={{ fontFamily: 'Cairo, sans-serif' }}>
              لا توجد أرقام مسحوبة سابقة بعد.
            </div>
          )}
        </div>

      </div>
    </ProtectedRoute>
  );
}
