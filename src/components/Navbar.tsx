'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, Award, Play, LayoutGrid, Tv, User, Home, ScrollText, Users, BarChart3 } from 'lucide-react';

interface UserSession {
  username: string;
  role: 'super_admin' | 'club';
  clubName?: string | null;
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
    if (role === 'super_admin') return 'سوبر أدمن';
    if (role === 'club') return 'نادي';
    return '';
  };

  // Hide navbars completely on specific routes
  const hideNavbarRoutes = ['/login', '/display', '/print', '/setup'];
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
      roles: ['super_admin', 'club'],
    },
    {
      name: 'اللعب',
      href: '/play',
      icon: Play,
      roles: ['super_admin', 'club'],
    },
    {
      name: 'السيتات',
      href: '/admin',
      icon: LayoutGrid,
      roles: ['super_admin', 'club'],
    },
    {
      name: 'فحص',
      href: '/check',
      icon: Award,
      roles: ['super_admin', 'club'],
    },
    {
      name: 'الخريطة',
      href: '/sheet',
      icon: ScrollText,
      roles: ['super_admin', 'club'],
    },
    {
      name: 'العرض',
      href: '/display',
      icon: Tv,
      roles: ['super_admin', 'club'],
    },
    {
      name: 'التقارير',
      href: '/reports',
      icon: BarChart3,
      roles: ['super_admin', 'club'],
    },
    {
      name: 'النوادي',
      href: '/admin/users',
      icon: Users,
      roles: ['super_admin'],
    },
  ];

  // Only show what this account may actually open
  const visibleTabs = allTabs.filter(tab => !userRole || tab.roles.includes(userRole));

  return (
    <>
      {/*
        Top Header Bar.
        On phones it is just the logo (navigation lives in the bottom bar).
        From md up the tabs move up here, where a mouse expects them.
      */}
      <header className="w-full h-14 md:h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 px-4 md:px-6 sticky top-0 z-40 select-none">
        <Link
          href="/"
          className="flex items-center gap-2 text-emerald-500 font-extrabold text-lg transition-transform active:scale-95 shrink-0"
        >
          <span>🎯</span>
          <span className="truncate">الدمبلة العراقية</span>
        </Link>

        {session && (
          <button
            onClick={handleLogout}
            title="تسجيل الخروج"
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-red-400 transition-all cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        )}

        <div className="hidden md:flex items-center gap-3">
          {session && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {session.clubName || session.username}
                <span className="text-slate-600"> · {getRoleLabel(session.role)}</span>
              </span>
              <button
                onClick={handleLogout}
                title="تسجيل الخروج"
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-all cursor-pointer"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                    : 'text-slate-400 border border-transparent hover:text-slate-100 hover:bg-slate-800'
                }`}
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <Icon size={16} className={isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Fixed Bottom Navigation Bar — phones only */}
      <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-16 bg-slate-950/95 border-t border-slate-800 flex items-center justify-around z-50 px-2 pb-safe select-none backdrop-blur-md">
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
