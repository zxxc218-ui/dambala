'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Role } from '@/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

const CACHED_USER = 'tambola_user';

/** The last account that signed in on this device, if any. */
function cachedUser(): { role?: Role } | null {
  try {
    const raw = localStorage.getItem(CACHED_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Client-side gate. It keeps the wrong screens out of sight, but it is only the
 * polite half of the story — every API route checks the signed session cookie
 * itself, so nothing here can be bypassed by editing the page.
 *
 * Which is exactly why a dead connection must not lock the app. Asking the
 * server who you are is the *nicety*; when the ask cannot be made, the answer
 * it gave last time is used instead. Nothing is risked by that: a device with a
 * cached role and no valid cookie can render the screen and still not read or
 * write a single thing, because the server is the one that decides. Refusing to
 * render would only mean the caller stares at a locked screen in a hall with no
 * signal, holding a game the device is perfectly able to run.
 */
export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'allowed' | 'denied' | 'offline'>('checking');

  useEffect(() => {
    let cancelled = false;

    const allowFromCache = () => {
      const user = cachedUser();
      if (user?.role && allowedRoles.includes(user.role)) {
        setState('allowed');
        return true;
      }
      return false;
    };

    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;

        if (!data.authenticated || !data.user) {
          localStorage.removeItem(CACHED_USER);
          router.replace('/login');
          return;
        }

        localStorage.setItem(CACHED_USER, JSON.stringify(data.user));
        setState(allowedRoles.includes(data.user.role) ? 'allowed' : 'denied');
      })
      .catch(() => {
        if (cancelled) return;
        // The server could not be reached — not the same thing as being told no.
        if (!allowFromCache()) setState('offline');
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

  if (state === 'offline') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
          <ShieldAlert size={24} />
        </div>
        <h2 className="text-sm font-black text-slate-200" style={{ fontFamily: 'Cairo, sans-serif' }}>
          ماكو نت، وما سجّلت دخول بهذا الجهاز من قبل
        </h2>
        <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs" style={{ fontFamily: 'Cairo, sans-serif' }}>
          سجّل دخول مرة وحدة وانت متصل بالنت، وبعدها التطبيق يفتح ويشتغل كامل بدون نت.
        </p>
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
          className="mt-1 bg-emerald-500 hover:bg-emerald-600 text-ink-fixed font-black py-2 px-5 rounded-xl text-xs transition-all"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          الرجوع للرئيسية
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
