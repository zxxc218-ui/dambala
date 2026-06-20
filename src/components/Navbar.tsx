'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, Award, Play, LayoutGrid, Tv, User, Home } from 'lucide-react';

interface UserSession {
  username: string;
  role: 'admin' | 'caller' | 'checker' | 'viewer';
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    // Read from localStorage first for immediate UI render
    const localUser = localStorage.getItem('tambola_user');
    if (localUser) {
      try {
        setSession(JSON.parse(localUser));
      } catch {}
    }

    // Double check with server to keep it synced
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setSession(data.user);
            localStorage.setItem('tambola_user', JSON.stringify(data.user));
          } else {
            setSession(null);
            localStorage.removeItem('tambola_user');
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    checkAuth();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setSession(null);
        localStorage.removeItem('tambola_user');
        router.push('/login');
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return 'مدير';
    if (role === 'caller') return 'منادي';
    if (role === 'checker') return 'مدقق';
    if (role === 'viewer') return 'عرض';
    return '';
  };

  // Hide navbars completely on specific routes
  const hideNavbarRoutes = ['/login', '/display', '/print'];
  if (hideNavbarRoutes.some(route => pathname === route || pathname?.startsWith(route + '/'))) {
    return null;
  }

  const userRole = session?.role;

  // Define tabs configuration
  const allTabs = [
    {
      name: 'الرئيسية',
      href: '/',
      icon: Home,
      roles: ['admin', 'caller', 'checker', 'viewer'],
    },
    {
      name: 'اللعب',
      href: '/play',
      icon: Play,
      roles: ['admin', 'caller'],
    },
    {
      name: 'السيتات',
      href: '/admin',
      icon: LayoutGrid,
      roles: ['admin'],
    },
    {
      name: 'فحص',
      href: '/check',
      icon: Award,
      roles: ['admin', 'checker'],
    },
    {
      name: 'العرض',
      href: '/display',
      icon: Tv,
      roles: ['admin', 'caller', 'viewer'],
    },
  ];

  // Filter tabs by user's role
  const visibleTabs = allTabs;

  return (
    <>
      {/* Top Header Bar */}
      <header className="w-full h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-center px-4 sticky top-0 z-40 select-none">
        <Link href="/" className="flex items-center gap-2 text-emerald-500 font-extrabold text-lg transition-transform active:scale-95">
          <span>🎯</span>
          <span>الدمبلة العراقية</span>
        </Link>
      </header>

      {/* Fixed Bottom Navigation Bar (Centered on desktop inside max-w-[430px]) */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-16 bg-slate-950/95 border-t border-slate-800 flex items-center justify-around z-50 px-2 pb-safe select-none backdrop-blur-md">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 transition-all active:scale-90 ${
                isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={20} className={isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
              <span className="text-[10px] tracking-wide">{tab.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
