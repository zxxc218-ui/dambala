import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Play, Award, LayoutGrid, ShieldAlert, CheckCircle2, Tv, ChevronLeft } from 'lucide-react';

export const revalidate = 0; // Disable caching to always reflect DB state

export default async function Home() {
  let setsCount = 0;
  let activeSession = null;

  try {
    const { count, error: countErr } = await supabase
      .from('sets')
      .select('*', { count: 'exact', head: true });
    
    if (!countErr) {
      setsCount = count || 0;
    }

    const { data: sessionRecord, error: sessionErr } = await supabase
      .from('draw_sessions')
      .select('name')
      .in('status', ['active', 'paused'])
      .maybeSingle();

    if (!sessionErr && sessionRecord) {
      activeSession = sessionRecord;
    }
  } catch (err) {
    console.error('Error fetching database count from Supabase:', err);
  }

  return (
    <>
      <Navbar />
      <div className="w-full px-5 py-6 flex flex-col gap-6 select-none pb-24">
        
        {/* Hero / Header Section */}
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 mb-3 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
            <span className="text-3xl">🎯</span>
          </div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight" style={{ fontFamily: 'Cairo, sans-serif' }}>
            الدمبلة العراقية
          </h1>
          <p className="text-xs text-slate-400 mt-2 max-w-[340px] mx-auto leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
            النظام السحابي الذكي لإدارة جولات السحب، طباعة السيتات، والتحقق من الفائزين فورياً.
          </p>
        </div>

        {/* Live Session Alert */}
        {activeSession && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs font-bold animate-pulse justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/50"></span>
            <span style={{ fontFamily: 'Cairo, sans-serif' }}>
              جلسة سحب جارية: {activeSession.name}
            </span>
          </div>
        )}

        {/* Database Status */}
        {setsCount === 0 ? (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl flex flex-col gap-3">
            <div className="flex gap-2.5">
              <ShieldAlert size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-extrabold text-sm" style={{ fontFamily: 'Cairo, sans-serif' }}>قاعدة البيانات فارغة!</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  لم يتم رفع أي سيتات أو بطاقات حتى الآن. يرجى تسجيل الدخول كمسؤول لاستيرادها من ملف CSV.
                </p>
              </div>
            </div>
            <Link 
              href="/login" 
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 text-center font-extrabold text-xs py-2 rounded-xl transition-all"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              تسجيل الدخول للنظام
            </Link>
          </div>
        ) : (
          <div className="bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl flex items-center gap-2.5">
            <CheckCircle2 size={18} className="flex-shrink-0" />
            <span className="font-bold text-xs text-slate-200" style={{ fontFamily: 'Cairo, sans-serif' }}>
              جاهز للتشغيل. يحتوي النظام على <strong className="text-emerald-400">{setsCount}</strong> سيت ({setsCount * 6} بطاقة).
            </span>
          </div>
        )}

        {/* Action Cards List */}
        <div className="flex flex-col gap-3">
          
          {/* Card 1: Play */}
          <Link 
            href="/play" 
            className="flex items-center gap-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-2xl p-4 transition-all duration-200 active:scale-[0.98] group"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <Play size={20} className="fill-emerald-400/20" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-extrabold text-slate-100" style={{ fontFamily: 'Cairo, sans-serif' }}>تشغيل اللعبة والسحب</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal" style={{ fontFamily: 'Cairo, sans-serif' }}>
                إيقاف وتدقيق سحب الأرقام 1-90 عشوائياً أو يدوياً.
              </p>
            </div>
            <ChevronLeft size={16} className="text-slate-500 group-hover:translate-x-[-2px] transition-transform" />
          </Link>

          {/* Card 2: Check Winner */}
          <Link 
            href="/check" 
            className="flex items-center gap-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-2xl p-4 transition-all duration-200 active:scale-[0.98] group"
          >
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20 group-hover:scale-105 transition-transform">
              <Award size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-extrabold text-slate-100" style={{ fontFamily: 'Cairo, sans-serif' }}>فحص الفائز والبطاقة</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal" style={{ fontFamily: 'Cairo, sans-serif' }}>
                التحقق الفوري للبطاقة وللأسطر الثلاثة والدمبلة.
              </p>
            </div>
            <ChevronLeft size={16} className="text-slate-500 group-hover:translate-x-[-2px] transition-transform" />
          </Link>

          {/* Card 3: Display TV */}
          <Link 
            href="/display" 
            className="flex items-center gap-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-2xl p-4 transition-all duration-200 active:scale-[0.98] group"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform">
              <Tv size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-extrabold text-slate-100" style={{ fontFamily: 'Cairo, sans-serif' }}>شاشة عرض التلفزيون</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal" style={{ fontFamily: 'Cairo, sans-serif' }}>
                واجهة مريحة وسينمائية لعرض الأرقام المسحوبة للاعبين.
              </p>
            </div>
            <ChevronLeft size={16} className="text-slate-500 group-hover:translate-x-[-2px] transition-transform" />
          </Link>

          {/* Card 4: Manage Sets */}
          <Link 
            href="/admin" 
            className="flex items-center gap-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-2xl p-4 transition-all duration-200 active:scale-[0.98] group"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-105 transition-transform">
              <LayoutGrid size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-extrabold text-slate-100" style={{ fontFamily: 'Cairo, sans-serif' }}>إدارة السيتات والتعديل</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal" style={{ fontFamily: 'Cairo, sans-serif' }}>
                تعديل وتحديث خلايا البطاقات الـ 150 يدوياً.
              </p>
            </div>
            <ChevronLeft size={16} className="text-slate-500 group-hover:translate-x-[-2px] transition-transform" />
          </Link>

        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-[10px] text-slate-500 font-medium" style={{ fontFamily: 'Cairo, sans-serif' }}>
          نظام الدمبلة العراقية الذكي &copy; {new Date().getFullYear()}
        </div>

      </div>
    </>
  );
}
