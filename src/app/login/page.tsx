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
      <div className="min-h-[calc(100vh-60px)] flex items-center justify-center w-full px-5 py-8">
        <div className="bg-slate-900/55 border border-slate-800 rounded-3xl shadow-2xl w-full p-6 md:p-8 backdrop-blur-sm">
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-100" style={{ fontFamily: 'Cairo, sans-serif' }}>تسجيل الدخول للعبة</h2>
            <p className="text-slate-400 text-xs mt-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
              يرجى إدخال اسم المستخدم وكلمة المرور للوصول لصلاحيات اللعبة.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-400 p-3 rounded-xl text-xs mb-5 font-bold flex items-center gap-2 text-right">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span style={{ fontFamily: 'Cairo, sans-serif' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="username" className="block text-slate-300 font-bold text-xs mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                اسم المستخدم
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin, caller, checker..."
                  required
                  className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                  disabled={loading}
                />
                <User size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-slate-300 font-bold text-xs mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
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
                  className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                  disabled={loading}
                />
                <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-3 px-6 rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-emerald-500/10 mt-2 cursor-pointer"
              disabled={loading}
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-800/80 pt-5 text-center text-[10px] text-slate-500 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
            الحسابات الافتراضية للتجربة (المستخدم / كلمة المرور):<br/>
            <strong className="text-slate-400">admin / admin123</strong> | <strong className="text-slate-400">caller / caller123</strong><br/>
            <strong className="text-slate-400">checker / checker123</strong> | <strong className="text-slate-400">viewer / viewer123</strong>
          </div>

        </div>
      </div>
    </>
  );
}
