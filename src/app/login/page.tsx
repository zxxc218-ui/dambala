'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { ShieldCheck, User, Lock, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect them to their home page
  useEffect(() => {
    const userStr = localStorage.getItem('tambola_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        redirectByRole(user.role);
      } catch {
        localStorage.removeItem('tambola_user');
      }
    }
  }, [router]);

  const redirectByRole = (role: string) => {
    if (role === 'admin') router.push('/admin');
    else if (role === 'caller') router.push('/play');
    else if (role === 'checker') router.push('/check');
    else if (role === 'viewer') router.push('/display');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('tambola_user', JSON.stringify(data.user));
        redirectByRole(data.user.role);
        router.refresh();
      } else {
        setError(data.message || 'حدث خطأ أثناء تسجيل الدخول');
      }
    } catch (err) {
      setError('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="container min-h-[calc(100vh-140px)] flex items-center justify-center max-w-md mx-auto px-4 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl w-full p-8 md:p-10">
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white" style={{ fontFamily: 'Cairo, sans-serif' }}>تسجيل الدخول للعبة</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
              يرجى إدخال اسم المستخدم وكلمة المرور للوصول لصلاحيات اللعبة.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-500 dark:bg-red-950/20 dark:text-red-400 p-3.5 rounded-lg text-sm mb-5 font-bold flex items-center gap-2 text-right">
              <AlertTriangle size={18} className="flex-shrink-0" />
              <span style={{ fontFamily: 'Cairo, sans-serif' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="username" className="block text-slate-700 dark:text-slate-300 font-bold text-sm mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                اسم المستخدم
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin, caller, checker, viewer"
                  required
                  className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:border-emerald-500 transition-colors text-sm"
                  disabled={loading}
                />
                <User size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-slate-700 dark:text-slate-300 font-bold text-sm mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:border-emerald-500 transition-colors text-sm"
                  disabled={loading}
                />
                <Lock size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3 px-6 rounded-lg text-base transition-colors shadow-lg shadow-emerald-500/20 mt-2"
              disabled={loading}
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-100 dark:border-slate-700 pt-5 text-center text-xs text-slate-400 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
            الحسابات الافتراضية للتجربة (المستخدم / كلمة المرور):<br/>
            <strong>admin / admin123</strong> | <strong>caller / caller123</strong><br/>
            <strong>checker / checker123</strong> | <strong>viewer / viewer123</strong>
          </div>

        </div>
      </div>
    </>
  );
}
