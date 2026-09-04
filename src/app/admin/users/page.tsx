'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  Users,
  Plus,
  Lock,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Power,
  Building2,
} from 'lucide-react';

interface AppUser {
  id: number;
  username: string;
  role: 'super_admin' | 'club';
  club_name: string | null;
  active: boolean;
  created_at: string;
}

export default function UsersAdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // new club form
  const [clubName, setClubName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  // per-row password reset
  const [resetFor, setResetFor] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        setError('');
      } else {
        setError(data.message || 'تعذر جلب المستخدمين');
      }
    } catch {
      setError('تعذر الاتصال بالسيرفر');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, clubName }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers((prev) => [...prev, data.user]);
        setClubName('');
        setUsername('');
        setPassword('');
        flash(data.message);
      } else {
        setError(data.message || 'تعذر إنشاء الحساب');
      }
    } catch {
      setError('تعذر الاتصال بالسيرفر');
    } finally {
      setCreating(false);
    }
  };

  const patch = async (id: number, body: Record<string, unknown>, okMessage: string) => {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers((prev) => prev.map((u) => (u.id === id ? data.user : u)));
        flash(okMessage);
        return true;
      }
      setError(data.message || 'تعذر حفظ التعديل');
      return false;
    } catch {
      setError('تعذر الاتصال بالسيرفر');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (user: AppUser) => {
    if (!window.confirm(`حذف حساب "${user.club_name || user.username}" نهائياً؟`)) return;
    setBusyId(user.id);
    setError('');
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        flash('تم حذف الحساب');
      } else {
        setError(data.message || 'تعذر حذف الحساب');
      }
    } catch {
      setError('تعذر الاتصال بالسيرفر');
    } finally {
      setBusyId(null);
    }
  };

  const clubs = users.filter((u) => u.role === 'club');
  const admins = users.filter((u) => u.role === 'super_admin');

  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <Navbar />
      <div className="w-full px-4 py-5 flex flex-col gap-5 select-none pb-24 md:pb-10">
        <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
          <div className="flex items-center gap-2 text-slate-100">
            <Users className="text-emerald-400" size={20} />
            <h1 className="text-sm font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>
              حسابات النوادي
            </h1>
          </div>
          <span className="text-[10px] font-bold text-slate-500" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {clubs.length} نادي
          </span>
        </div>

        {notice && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs font-bold flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <CheckCircle2 size={15} /> {notice}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/25 text-red-400 p-3 rounded-xl text-xs font-bold flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <AlertTriangle size={15} className="flex-shrink-0" /> {error}
          </div>
        )}

        {/* Create a club */}
        <form
          onSubmit={handleCreate}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 w-full md:max-w-2xl md:mx-auto"
        >
          <h2 className="text-xs font-black text-slate-200 flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <Plus size={14} className="text-emerald-400" /> إضافة نادي جديد
          </h2>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400" style={{ fontFamily: 'Cairo, sans-serif' }}>اسم النادي</span>
              <input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="نادي الرافدين"
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 text-sm"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400" style={{ fontFamily: 'Cairo, sans-serif' }}>اسم المستخدم</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="rafidain.club"
                dir="ltr"
                autoComplete="off"
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 text-sm font-mono"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400" style={{ fontFamily: 'Cairo, sans-serif' }}>كلمة السر</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                autoComplete="new-password"
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 text-sm font-mono"
                required
              />
            </label>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
            8 خانات على الأقل مع حروف وأرقام. تنحفظ مشفّرة — ما راح تقدر تشوفها بعدين، بس تقدر تغيّرها بأي وقت.
          </p>

          <button
            type="submit"
            disabled={creating}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {creating ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
          </button>
        </form>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-12 text-slate-500">
            <Loader2 className="animate-spin text-emerald-500" size={22} />
            <span className="text-xs" style={{ fontFamily: 'Cairo, sans-serif' }}>جاري التحميل...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 w-full md:max-w-2xl md:mx-auto">
            {clubs.length === 0 && (
              <div className="text-center text-xs text-slate-500 py-8" style={{ fontFamily: 'Cairo, sans-serif' }}>
                ما موجود نوادي بعد. أضف أول نادي من الأعلى.
              </div>
            )}

            {clubs.map((user) => (
              <div key={user.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-slate-100 font-black text-sm" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      <Building2 size={15} className="text-emerald-400 flex-shrink-0" />
                      <span className="truncate">{user.club_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-1" dir="ltr">{user.username}</div>
                  </div>

                  <span
                    className={`text-[9px] font-black px-2 py-1 rounded-lg border flex-shrink-0 ${
                      user.active
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    {user.active ? 'مفعّل' : 'معطّل'}
                  </span>
                </div>

                {resetFor === user.id ? (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="كلمة سر جديدة"
                      dir="ltr"
                      autoComplete="new-password"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 text-sm font-mono"
                    />
                    <button
                      onClick={async () => {
                        const ok = await patch(user.id, { password: resetPassword }, 'تم تغيير كلمة السر');
                        if (ok) {
                          setResetFor(null);
                          setResetPassword('');
                        }
                      }}
                      disabled={busyId === user.id}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-[11px] font-black cursor-pointer"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      حفظ
                    </button>
                    <button
                      onClick={() => {
                        setResetFor(null);
                        setResetPassword('');
                      }}
                      className="px-3 py-2 bg-slate-800 text-slate-300 rounded-xl text-[11px] font-black cursor-pointer"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setResetFor(user.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg text-[10px] font-bold cursor-pointer"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      <Lock size={11} /> تغيير كلمة السر
                    </button>

                    <button
                      onClick={() =>
                        patch(user.id, { active: !user.active }, user.active ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب')
                      }
                      disabled={busyId === user.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 hover:text-amber-400 rounded-lg text-[10px] font-bold cursor-pointer"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      <Power size={11} /> {user.active ? 'تعطيل' : 'تفعيل'}
                    </button>

                    <button
                      onClick={() => handleDelete(user)}
                      disabled={busyId === user.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-[10px] font-bold cursor-pointer"
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      <Trash2 size={11} /> حذف
                    </button>
                  </div>
                )}
              </div>
            ))}

            {admins.length > 0 && (
              <div className="mt-4 text-[10px] text-slate-500 text-center leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                حسابات السوبر أدمن: {admins.map((a) => a.username).join('، ')}
              </div>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
