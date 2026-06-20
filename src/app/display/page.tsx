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
    return session.numbers.map((n: any) => n.number);
  };

  const drawnList = getDrawnNumbers();
  const lastDrawn = drawnList.length > 0 ? drawnList[drawnList.length - 1] : null;
  const lastTen = [...drawnList].reverse().slice(1, 11);

  return (
    <ProtectedRoute allowedRoles={['admin', 'caller', 'viewer']}>
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-5 select-none overflow-hidden font-sans">
        
        {/* Header bar */}
        <div className="flex justify-between items-center border-b border-slate-900 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Tv size={22} />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wide" style={{ fontFamily: 'Cairo, sans-serif' }}>
                شاشة عرض أرقام الدمبلة
              </h1>
              <p className="text-[9px] text-slate-500 mt-0.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                مزامنة حية تلقائية مع جولة السحب
              </p>
            </div>
          </div>

          <div className="text-right">
            {session ? (
              <div className="flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  جولة: {session.name}
                </span>
                <span className="text-[9px] text-slate-500 font-semibold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  المسحوبات: {drawnList.length} رقم
                </span>
              </div>
            ) : error ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {error}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-900 text-slate-500" style={{ fontFamily: 'Cairo, sans-serif' }}>
                بانتظار بدء الجلسة
              </span>
            )}
          </div>
        </div>

        {/* Center: Large Last Drawn Number */}
        <div className="flex-1 flex flex-col items-center justify-center py-6">
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="animate-spin text-emerald-500" size={36} />
              <span className="text-slate-400 text-xs font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>جاري المزامنة...</span>
            </div>
          ) : lastDrawn !== null ? (
            <div className="flex flex-col items-center">
              <span className="text-slate-400 text-xs font-bold tracking-widest mb-3" style={{ fontFamily: 'Cairo, sans-serif' }}>
                الرقم المسحوب الأخير
              </span>
              <div className="relative">
                {/* Glow behind */}
                <div className="absolute inset-0 bg-emerald-500/10 blur-[80px] rounded-full"></div>
                {/* Number sphere - scaled to fit perfectly inside 430px */}
                <div className="relative w-56 h-56 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-[0_0_60px_rgba(16,172,132,0.2)] border-6 border-slate-900/80 animate-[popIn_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">
                  <span className="text-8xl font-black text-slate-950 font-mono tracking-tighter leading-none select-none">
                    {lastDrawn}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-6 bg-slate-900/40 border border-slate-900 rounded-2xl max-w-xs mx-auto">
              <div className="w-14 h-14 bg-slate-900 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-800">
                <Info size={24} />
              </div>
              <h2 className="text-sm font-black text-slate-350 mb-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                بانتظار سحب الرقم الأول
              </h2>
              <p className="text-slate-500 text-[10px] leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                عندما يقوم المنادي بسحب رقم جديد، سيظهر مباشرة على هذه الشاشة بأبعاد كبيرة ومقروءة للاعبين.
              </p>
            </div>
          )}
        </div>

        {/* Bottom: Last 10 numbers list */}
        <div className="border-t border-slate-900 pt-5 pb-2">
          <div className="text-slate-500 text-xs font-bold mb-3 text-center" style={{ fontFamily: 'Cairo, sans-serif' }}>
            آخر 10 أرقام مسحوبة سابقة:
          </div>

          {lastTen.length > 0 ? (
            <div className="flex flex-wrap md:flex-row-reverse justify-center gap-2 items-center py-1">
              {lastTen.map((num, idx) => (
                <div
                  key={idx}
                  className="w-11 h-11 rounded-full bg-slate-900 border border-slate-850 flex items-center justify-center shadow-md"
                >
                  <span className="text-sm font-black text-slate-300 font-mono">
                    {num}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-600 text-center py-2 text-[10px] font-medium" style={{ fontFamily: 'Cairo, sans-serif' }}>
              لا توجد أرقام مسحوبة سابقة بعد.
            </div>
          )}
        </div>

      </div>
    </ProtectedRoute>
  );
}
