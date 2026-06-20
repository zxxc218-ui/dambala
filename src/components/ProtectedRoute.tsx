'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ('admin' | 'caller' | 'checker' | 'viewer')[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const userStr = localStorage.getItem('tambola_user');
    if (!userStr) {
      router.push('/login');
      return;
    }
    try {
      const user = JSON.parse(userStr);
      if (allowedRoles.includes(user.role)) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
      }
    } catch {
      router.push('/login');
    }
  }, [allowedRoles, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('tambola_user');
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 text-center">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-red-100 dark:border-red-950/30">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3" style={{ fontFamily: 'Cairo, sans-serif' }}>
            ليس لديك صلاحية لدخول هذه الصفحة
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
            حسابك لا يمتلك الصلاحيات الكافية للوصول إلى هذا القسم. يرجى تسجيل الدخول بحساب يمتلك دوراً متوافقاً.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-500/20"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <LogOut size={16} />
              تسجيل الخروج
            </button>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-bold rounded-lg transition-colors"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              صفحة الدخول
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
