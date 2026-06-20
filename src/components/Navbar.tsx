'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, Award, Play, Printer, FileDown, LayoutGrid, Tv, User } from 'lucide-react';

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
        const data = await res.json();
        if (data.authenticated && data.user) {
          setSession(data.user);
          localStorage.setItem('tambola_user', JSON.stringify(data.user));
        } else {
          setSession(null);
          localStorage.removeItem('tambola_user');
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
    if (role === 'admin') return 'مدير النظام';
    if (role === 'caller') return 'المنادي';
    if (role === 'checker') return 'المدقق';
    if (role === 'viewer') return 'شاشة العرض';
    return '';
  };

  const userRole = session?.role;

  return (
    <nav className="navbar no-print">
      <div className="navbar-container">
        <Link href="/" className="logo">
          <span>🎯</span>
          <span>الدمبلة العراقية</span>
        </Link>

        <div className="nav-links">
          {/* Admin and Caller links */}
          {(userRole === 'admin' || userRole === 'caller') && (
            <Link href="/play" className={`nav-link ${pathname === '/play' ? 'active' : ''}`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Play size={16} /> تشغيل اللعبة
              </span>
            </Link>
          )}

          {/* Admin, Caller, Viewer links */}
          {(userRole === 'admin' || userRole === 'caller' || userRole === 'viewer') && (
            <Link href="/display" className={`nav-link ${pathname === '/display' ? 'active' : ''}`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Tv size={16} /> شاشة العرض
              </span>
            </Link>
          )}
          
          {/* Admin and Checker links */}
          {(userRole === 'admin' || userRole === 'checker') && (
            <Link href="/check" className={`nav-link ${pathname === '/check' ? 'active' : ''}`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Award size={16} /> فحص الفائز
              </span>
            </Link>
          )}

          {/* Admin only print/sets/import links */}
          {userRole === 'admin' && (
            <>
              <Link href="/print" className={`nav-link ${pathname === '/print' ? 'active' : ''}`}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Printer size={16} /> طباعة
                </span>
              </Link>

              <Link href="/admin" className={`nav-link ${pathname === '/admin' ? 'active' : ''}`}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <LayoutGrid size={16} /> السيتات
                </span>
              </Link>

              <Link href="/admin/import" className={`nav-link ${pathname === '/admin/import' ? 'active' : ''}`}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <FileDown size={16} /> استيراد CSV
                </span>
              </Link>
            </>
          )}
        </div>

        <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="hidden-sm" style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text)' }}>{session.username}</span>
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>{getRoleLabel(session.role)}</span>
              </div>
              <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '13px' }}>
                <LogOut size={14} /> خروج
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
              <User size={14} /> تسجيل الدخول
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
