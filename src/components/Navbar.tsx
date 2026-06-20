'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, ShieldAlert, Award, Play, Printer, FileDown, LayoutGrid } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if admin is logged in
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        setIsAdmin(data.authenticated);
      } catch (err) {
        setIsAdmin(false);
      }
    }
    checkAuth();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setIsAdmin(false);
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <nav className="navbar no-print">
      <div className="navbar-container">
        <Link href="/" className="logo">
          <span>🎯</span>
          <span>الدمبلة العراقية</span>
        </Link>

        <div className="nav-links">
          <Link href="/play" className={`nav-link ${pathname === '/play' ? 'active' : ''}`}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Play size={16} /> تشغيل اللعبة
            </span>
          </Link>
          
          <Link href="/check-winner" className={`nav-link ${pathname === '/check-winner' ? 'active' : ''}`}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Award size={16} /> فحص الفائز
            </span>
          </Link>

          <Link href="/print" className={`nav-link ${pathname === '/print' ? 'active' : ''}`}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Printer size={16} /> طباعة
            </span>
          </Link>

          <Link href="/admin/sets" className={`nav-link ${pathname?.startsWith('/admin/sets') ? 'active' : ''}`}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <LayoutGrid size={16} /> السيتات
            </span>
          </Link>

          {isAdmin && (
            <Link href="/admin/import" className={`nav-link ${pathname === '/admin/import' ? 'active' : ''}`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <FileDown size={16} /> استيراد CSV
              </span>
            </Link>
          )}
        </div>

        <div className="nav-actions">
          {isAdmin ? (
            <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '13px' }}>
              <LogOut size={14} /> تسجيل خروج
            </button>
          ) : (
            <Link href="/login" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
              <ShieldAlert size={14} /> دخول الأدمن
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
