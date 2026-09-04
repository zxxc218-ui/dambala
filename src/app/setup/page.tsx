'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, User, AlertTriangle, CheckCircle2, Loader2, Database } from 'lucide-react';

/**
 * First-run screen: the owner creates the super admin account here, typing the
 * password into their own browser. The server stores only a hash of it.
 * Once a super admin exists the screen locks itself.
 */
export default function SetupPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [alreadySetUp, setAlreadySetUp] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [hasServiceRole, setHasServiceRole] = useState(true);
  const [checkMessage, setCheckMessage] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/setup')
      .then((r) => r.json())
      .then((d) => {
        setAlreadySetUp(Boolean(d.alreadySetUp));
        setTableMissing(Boolean(d.tableMissing));
        setHasServiceRole(d.hasServiceRole !== false);
        if (!d.success && d.message) setCheckMessage(d.message);
      })
      .catch(() => setCheckMessage('تعذر الاتصال بالسيرفر'))
      .finally(() => setChecking(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('كلمتا السر غير متطابقتين');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('tambola_user', JSON.stringify(data.user));
        router.push('/admin/users');
      } else {
        setError(data.message || 'تعذر إنشاء الحساب');
      }
    } catch {
      setError('تعذر الاتصال بالسيرفر');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center w-full px-5 py-10">
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg p-6 md:p-8">
        <div className="text-center mb-7">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-lg font-black text-slate-100" style={{ fontFamily: 'Cairo, sans-serif' }}>
            تهيئة النظام
          </h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
            أنشئ حساب السوبر أدمن. كلمة السر تنحفظ مشفّرة ولا يقدر أحد يقراها — ولا حتى من قاعدة البيانات.
          </p>
        </div>

        {checking ? (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
            <Loader2 className="animate-spin text-emerald-500" size={22} />
            <span className="text-xs" style={{ fontFamily: 'Cairo, sans-serif' }}>جاري الفحص...</span>
          </div>
        ) : tableMissing ? (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl flex flex-col gap-3 text-right">
            <h2 className="text-sm font-black flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
              <Database size={18} /> جدول المستخدمين غير موجود
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
              شغّل سكربت SQL الموجود في ملف <span className="font-mono text-slate-200">db/users.sql</span> داخل
              لوحة Supabase (SQL Editor)، وبعدها حدّث هذي الصفحة.
            </p>
          </div>
        ) : alreadySetUp ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl flex flex-col gap-3 text-center">
            <CheckCircle2 size={22} className="mx-auto" />
            <p className="text-xs font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
              النظام مهيّأ مسبقاً. سجّل دخول بحساب السوبر أدمن.
            </p>
            <a
              href="/login"
              className="mt-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-all"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              صفحة تسجيل الدخول
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!hasServiceRole && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-xl text-[11px] leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <strong className="block mb-1">تنبيه:</strong>
                مفتاح <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> غير مضاف في Vercel.
                النظام راح يشتغل، بس جدول المستخدمين يبقى مكشوفاً لمفتاح anon. أضف المفتاح لإغلاقه.
              </div>
            )}

            {checkMessage && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-[11px]" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {checkMessage}
              </div>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <User size={13} /> اسم المستخدم
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="مثال: hasan.abd"
                dir="ltr"
                className="px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 text-sm font-mono"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <Lock size={13} /> كلمة السر (8 خانات على الأقل، حروف وأرقام)
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                dir="ltr"
                className="px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 text-sm font-mono"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <Lock size={13} /> تأكيد كلمة السر
              </span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                dir="ltr"
                className="px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 text-sm font-mono"
                required
              />
            </label>

            {error && (
              <div className="bg-red-500/10 border border-red-500/25 text-red-400 p-3 rounded-xl text-xs font-bold flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <AlertTriangle size={15} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black py-3 rounded-2xl text-sm transition-all active:scale-[0.98] cursor-pointer"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {saving ? 'جاري الإنشاء...' : 'إنشاء حساب السوبر أدمن'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
