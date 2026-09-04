'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Role } from '@/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

/**
 * Client-side gate. It keeps the wrong screens out of sight, but it is only the
 * polite half of the story — every API route checks the signed session cookie
 * itself, so nothing here can be bypassed by editing the page.
 */
export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;

        if (!data.authenticated || !data.user) {
          localStorage.removeItem('tambola_user');
          router.replace('/login');
          return;
        }

        localStorage.setItem('tambola_user', JSON.stringify(data.user));
        setState(allowedRoles.includes(data.user.role) ? 'allowed' : 'denied');
      })
      .catch(() => {
        if (!cancelled) setState('denied');
      });

    return () => {
      cancelled = true;
    };
    // allowedRoles is a literal at every call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (state === 'checking') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-2 text-slate-500">
        <Loader2 className="animate-spin text-emerald-500" size={24} />
        <span className="text-xs font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
          جاري التحقق...
        </span>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
          <ShieldAlert size={24} />
        </div>
        <h2 className="text-sm font-black text-slate-200" style={{ fontFamily: 'Cairo, sans-serif' }}>
          ما عندك صلاحية لهذي الصفحة
        </h2>
        <a
          href="/"
          className="mt-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-2 px-5 rounded-xl text-xs transition-all"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          الرجوع للرئيسية
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
