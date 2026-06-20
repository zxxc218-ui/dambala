'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Play, Pause, RotateCcw, Award, CheckCircle2, History, AlertTriangle, Sparkles, Loader2, Plus, X } from 'lucide-react';

interface DrawSession {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'finished';
  numbers: { number: number; drawOrder: number }[];
}

interface Winner {
  setNo: number;
  cardNo: number;
  winType?: string;
  row1?: boolean;
  row2?: boolean;
  row3?: boolean;
  fullCard?: boolean;
}

export default function PlayPage() {
  const [session, setSession] = useState<DrawSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Manual Draw State
  const [manualNumber, setManualNumber] = useState('');
  const [addingManual, setAddingManual] = useState(false);

  // New Winner Alerts State
  const [activeNewWinners, setActiveNewWinners] = useState<Winner[]>([]);
  
  // All Winners Report State
  const [allWinners, setAllWinners] = useState<Winner[] | null>(null);
  const [loadingAllWinners, setLoadingAllWinners] = useState(false);

  // Fetch current session on mount
  useEffect(() => {
    fetchCurrentSession();
  }, []);

  const fetchCurrentSession = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions/current');
      const data = await res.json();
      if (data.success) {
        setSession(data.session);
      }
    } catch (err) {
      console.error('Failed to fetch current session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSessionName }),
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.session);
        setNewSessionName('');
        setAllWinners(null);
        setActiveNewWinners([]);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('تعذر الاتصال بالخادم لبدء الجلسة');
    } finally {
      setCreating(false);
    }
  };

  const processDrawResult = (data: any) => {
    if (session) {
      setSession({
        ...session,
        numbers: [...session.numbers, { number: data.number, drawOrder: data.order }]
      });

      // If new winners are detected, trigger alert popup
      if (data.newWinners && data.newWinners.length > 0) {
        setActiveNewWinners(data.newWinners);
      }
    }
  };

  const handleDrawRandomNumber = async () => {
    if (!session || drawing || session.status !== 'active') return;
    setDrawing(true);
    setError('');

    try {
      const res = await fetch('/api/sessions/current/draw', {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        processDrawResult(data);
      } else {
        setError(data.message || 'حدث خطأ أثناء سحب الرقم');
      }
    } catch (err) {
      setError('فشل سحب رقم جديد، يرجى المحاولة لاحقاً');
    } finally {
      setDrawing(false);
    }
  };

  const handleAddManualNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || addingManual || session.status !== 'active') return;
    
    setError('');
    const num = parseInt(manualNumber, 10);
    if (isNaN(num) || num < 1 || num > 90) {
      setError('يرجى إدخال رقم صحيح بين 1 و 90');
      return;
    }

    setAddingManual(true);

    try {
      const res = await fetch('/api/sessions/current/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: num })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        processDrawResult(data);
        setManualNumber(''); // Reset field
      } else {
        setError(data.message || 'حدث خطأ أثناء إضافة الرقم يدوياً');
      }
    } catch (err) {
      setError('تعذر إضافة الرقم يدوياً للسيرفر');
    } finally {
      setAddingManual(false);
    }
  };

  const handleNumberClick = async (num: number) => {
    if (!session || drawing || addingManual) return;
    if (session.status !== 'active') {
      alert('يرجى استئناف اللعب أولاً لسحب الأرقام');
      return;
    }

    if (drawnNumbers.includes(num)) {
      return;
    }

    setDrawing(true);
    setError('');

    try {
      const res = await fetch('/api/sessions/current/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: num })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        processDrawResult(data);
      } else {
        setError(data.message || 'حدث خطأ أثناء سحب الرقم');
      }
    } catch (err) {
      setError('تعذر الاتصال بالسيرفر لسحب الرقم');
    } finally {
      setDrawing(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!session) return;
    const targetStatus = session.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch('/api/sessions/current/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus })
      });
      const data = await res.json();
      if (data.success) {
        setSession(prev => {
          if (!prev) return null;
          return { ...prev, status: targetStatus };
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetSession = async () => {
    if (!session) return;
    const confirmed = window.confirm(
      'تحذير هام: هل أنت متأكد من مسح جميع الأرقام المسحوبة الحالية وإعادة ضبط الجلسة للبدء من جديد؟ لا يمكن استرجاع الأرقام المحذوفة.'
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/sessions/current/reset', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setSession(prev => {
          if (!prev) return null;
          return { ...prev, numbers: [], status: 'active' };
        });
        setAllWinners(null);
        setActiveNewWinners([]);
        setError('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFinishSession = async () => {
    if (!session) return;
    const confirmed = window.confirm('هل تريد إنهاء هذه الجلسة وإغلاقها نهائياً؟');
    if (!confirmed) return;

    try {
      const res = await fetch('/api/sessions/current/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'finished' })
      });
      const data = await res.json();
      if (data.success) {
        setSession(null);
        setAllWinners(null);
        setActiveNewWinners([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckAllWinners = async () => {
    if (!session) return;
    setLoadingAllWinners(true);
    setAllWinners(null);
    try {
      const res = await fetch('/api/sessions/current/winners');
      const data = await res.json();
      if (data.success) {
        setAllWinners(data.winners);
      } else {
        alert(data.message || 'فشل فحص الفائزين');
      }
    } catch (err) {
      alert('تعذر الاتصال بالسيرفر لفحص البطاقات');
    } finally {
      setLoadingAllWinners(false);
    }
  };

  // Helper values
  const drawnNumbers = session?.numbers.map(n => n.number) || [];
  const latestDraw = session && session.numbers.length > 0
    ? session.numbers[session.numbers.length - 1].number
    : null;
  const previousDraw = session && session.numbers.length > 1
    ? session.numbers[session.numbers.length - 2].number
    : null;

  const formatSetNo = (no: number) => String(no).padStart(3, '0');
  const formatCardNo = (no: number) => String(no).padStart(2, '0');

  return (
    <>
      <Navbar />
      <div className="container" style={{ maxWidth: '1100px', paddingBottom: '80px' }}>
        
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: '8px' }}>
            <Loader2 className="animate-spin" size={24} />
            <span>جاري تحميل بيانات اللعبة...</span>
          </div>
        ) : !session ? (
          /* NO ACTIVE SESSION */
          <div className="card" style={{ maxWidth: '600px', margin: '40px auto', padding: '40px 32px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Sparkles size={32} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: '800' }}>بدء جلسة سحب جديدة</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
                للبدء بسحب الأرقام ومراقبة الفائزين، يرجى تشغيل الجلسة أولاً.
              </p>
            </div>

            {error && (
              <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '14px', marginBottom: '20px', fontWeight: '600' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleStartSession} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label htmlFor="session-name" style={{ display: 'block', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>
                  اسم الجلسة (اختياري)
                </label>
                <input
                  type="text"
                  id="session-name"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="مثال: سحب ديوان الجمعية"
                  className="input-field"
                  disabled={creating}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '12px', fontSize: '16px', width: '100%' }} disabled={creating}>
                {creating ? 'جاري تهيئة الجلسة...' : 'ابدأ جلسة السحب الآن 🎲'}
              </button>
            </form>
          </div>
        ) : (
          /* PLAY SESSION RUNNING */
          <div>
            
            {/* Top Control Header Card */}
            <div className="card" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700' }}>جلسة السحب واللعب الحالية</span>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text)' }}>{session.name}</h2>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={handleCheckAllWinners}
                  className="btn btn-outline"
                  style={{ padding: '8px 14px', fontSize: '13px', borderColor: '#3498db', color: '#3498db', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Award size={14} /> فحص كل الفائزين
                </button>

                <div style={{
                  background: session.status === 'active' ? 'var(--primary-light)' : '#fff3cd',
                  color: session.status === 'active' ? 'var(--primary)' : '#856404',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontWeight: '700',
                  fontSize: '13px'
                }}>
                  {session.status === 'active' ? 'نشط' : 'متوقف مؤقتا'}
                </div>

                <button onClick={handleToggleStatus} className="btn btn-outline" style={{ padding: '8px 14px', fontSize: '13px' }}>
                  {session.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                  <span style={{ marginRight: '4px' }}>{session.status === 'active' ? 'إيقاف مؤقت' : 'استئناف'}</span>
                </button>

                <button onClick={handleResetSession} className="btn btn-outline" style={{ padding: '8px 14px', fontSize: '13px', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                  <RotateCcw size={14} /> إعادة الجلسة
                </button>

                <button onClick={handleFinishSession} className="btn btn-danger" style={{ padding: '8px 14px', fontSize: '13px' }}>
                  إنهاء اللعبة
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontWeight: '700' }}>
                {error}
              </div>
            )}

            {/* Split Screen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', alignItems: 'start' }}>
              
              {/* Scoreboard of 1-90 */}
              <div className="card">
                <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📋</span> لوحة الأرقام المكتملة (1 إلى 90)
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '8px', direction: 'ltr' }}>
                  {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => {
                    const isDrawn = drawnNumbers.includes(n);
                    const isLatest = latestDraw === n;

                    return (
                      <div
                        key={n}
                        onClick={() => handleNumberClick(n)}
                        className={`board-number-cell ${isDrawn ? 'drawn' : 'undrawn'}`}
                        style={{
                          aspectRatio: '1',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                          fontWeight: '800',
                          background: isLatest ? 'var(--accent)' : isDrawn ? 'var(--primary)' : '#f1f2f6',
                          color: isLatest ? '#2f3640' : isDrawn ? 'white' : 'var(--text-muted)',
                          border: isLatest ? '2px solid #2f3640' : 'none',
                          boxShadow: isLatest ? '0 0 8px var(--accent)' : 'none',
                          cursor: isDrawn ? 'default' : 'pointer'
                        }}
                      >
                        {n}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '20px', fontSize: '13px', fontWeight: '600', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'var(--primary)' }}></div>
                    <span>مسحوبة ({drawnNumbers.length})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'var(--accent)' }}></div>
                    <span>آخر رقم مسحوب</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#f1f2f6' }}></div>
                    <span>متبقية ({90 - drawnNumbers.length})</span>
                  </div>
                </div>
              </div>

              {/* Side Panels: Drawing Sphere, Manual Draw Input, history */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Random Draw Sphere */}
                <div className="card" style={{
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #10ac84 0%, #22a6b3 100%)',
                  color: 'white',
                  padding: '30px 16px 24px'
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', opacity: 0.85 }}>الرقم الحالي المسحوب</span>
                  
                  <div style={{
                    width: '150px',
                    height: '150px',
                    borderRadius: '50%',
                    background: 'white',
                    color: '#2f3640',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '68px',
                    fontWeight: '900',
                    margin: '16px auto',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
                  }}>
                    {latestDraw ? latestDraw : '-'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '12px', opacity: 0.9, marginBottom: '20px' }}>
                    <div>الرقم السابق: <strong>{previousDraw || '-'}</strong></div>
                    <div>ترتيب السحب: <strong>{drawnNumbers.length} / 90</strong></div>
                  </div>

                  <button
                    onClick={handleDrawRandomNumber}
                    disabled={drawing || session.status !== 'active' || drawnNumbers.length >= 90}
                    className="btn"
                    style={{
                      width: '100%',
                      padding: '14px',
                      fontSize: '17px',
                      fontWeight: '800',
                      background: 'white',
                      color: 'var(--primary)',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
                      cursor: session.status === 'active' ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {drawing ? 'جاري السحب...' : 'سحب رقم عشوائي 🎲'}
                  </button>
                </div>

                {/* Manual Draw Input Form */}
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> إضافة رقم مسحوب يدوياً:
                  </h3>

                  <form onSubmit={handleAddManualNumber} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={manualNumber}
                      onChange={(e) => setManualNumber(e.target.value)}
                      placeholder="رقم (1-90)"
                      className="input-field"
                      style={{ flex: 1, padding: '8px 12px' }}
                      disabled={addingManual || session.status !== 'active'}
                      required
                    />
                    <button
                      type="submit"
                      className="btn btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '14px' }}
                      disabled={addingManual || session.status !== 'active'}
                    >
                      {addingManual ? 'جاري الإضافة...' : 'إضافة'}
                    </button>
                  </form>
                </div>

                {/* Recent Logs */}
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <History size={16} /> تاريخ السحب (تنازلي):
                  </h3>

                  {session.numbers.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '12px 0' }}>
                      لا توجد أرقام مسحوبة حالياً
                    </p>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      padding: '4px',
                      direction: 'ltr',
                      justifyContent: 'flex-end'
                    }}>
                      {[...session.numbers].reverse().map((n) => (
                        <div key={n.drawOrder} style={{ padding: '5px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: '700' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginRight: '4px' }}>#{n.drawOrder}</span>
                          <span style={{ color: 'var(--primary)' }}>{n.number}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* -------------------- 1. POPUP MODAL: NEW WINNER ALERT -------------------- */}
            {activeNewWinners.length > 0 && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 200,
                direction: 'rtl'
              }}>
                <div className="card" style={{
                  width: '90%',
                  maxWidth: '460px',
                  textAlign: 'center',
                  padding: '32px 24px',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
                  border: '3px solid var(--primary)',
                  position: 'relative',
                  background: 'white',
                  animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                  <button
                    onClick={() => setActiveNewWinners([])}
                    style={{ position: 'absolute', top: '16px', left: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <X size={20} />
                  </button>

                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', animation: 'pulse 1.5s infinite' }}>
                    <Award size={32} />
                  </div>

                  <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--primary)', marginBottom: '8px' }}>
                    🏆 يوجد فائز جديد! 🏆
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
                    تم اكتمال خطوط اللعب للبطاقات التالية بفعل الرقم الأخير:
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', marginBottom: '24px' }}>
                    {activeNewWinners.map((winner, idx) => (
                      <div key={idx} style={{
                        padding: '12px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontWeight: '800', fontSize: '14px' }}>
                          السيت: {formatSetNo(winner.setNo)} | البطاقة: {formatCardNo(winner.cardNo)}
                        </span>
                        <span style={{
                          background: winner.winType === 'البطاقة كاملة (دمبلة)' ? 'var(--accent)' : 'var(--primary-light)',
                          color: winner.winType === 'البطاقة كاملة (دمبلة)' ? '#2f3640' : 'var(--primary)',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontWeight: '800',
                          fontSize: '12px'
                        }}>
                          {winner.winType}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => setActiveNewWinners([])} className="btn btn-primary" style={{ width: '100%' }}>
                    متابعة اللعب 🎲
                  </button>
                </div>
              </div>
            )}

            {/* -------------------- 2. POPUP MODAL: ALL WINNERS REPORT -------------------- */}
            {allWinners !== null && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 190,
                direction: 'rtl'
              }}>
                <div className="card" style={{
                  width: '90%',
                  maxWidth: '650px',
                  padding: '30px',
                  borderRadius: 'var(--radius-md)',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                  position: 'relative',
                  background: 'white'
                }}>
                  
                  <button
                    onClick={() => setAllWinners(null)}
                    style={{ position: 'absolute', top: '16px', left: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <X size={20} />
                  </button>

                  <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award style={{ color: 'var(--primary)' }} /> تقرير الفائزين الإجمالي بالجلسة
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
                    قائمة بجميع البطاقات التي حققت فوزاً بخط واحد أو أكثر مقارنة بكامل الأرقام المسحوبة بالجلسة.
                  </p>

                  {allWinners.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      <AlertTriangle size={36} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
                      <p>لا يوجد أي بطاقة فائزة في الجلسة حتى الآن.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                            <th style={{ padding: '10px' }}>السيت</th>
                            <th style={{ padding: '10px' }}>البطاقة</th>
                            <th style={{ padding: '10px' }}>الخط الأول</th>
                            <th style={{ padding: '10px' }}>الخط الثاني</th>
                            <th style={{ padding: '10px' }}>الخط الثالث</th>
                            <th style={{ padding: '10px' }}>البطاقة كاملة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allWinners.map((winner, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px', fontWeight: '800' }}>Set {formatSetNo(winner.setNo)}</td>
                              <td style={{ padding: '10px', fontWeight: '800' }}>Card {formatCardNo(winner.cardNo)}</td>
                              
                              <td style={{ padding: '10px', fontWeight: '700', color: winner.row1 ? 'var(--primary)' : 'var(--text-muted)' }}>
                                {winner.row1 ? '✅ فائز' : 'غير فائز'}
                              </td>
                              <td style={{ padding: '10px', fontWeight: '700', color: winner.row2 ? 'var(--primary)' : 'var(--text-muted)' }}>
                                {winner.row2 ? '✅ فائز' : 'غير فائز'}
                              </td>
                              <td style={{ padding: '10px', fontWeight: '700', color: winner.row3 ? 'var(--primary)' : 'var(--text-muted)' }}>
                                {winner.row3 ? '✅ فائز' : 'غير فائز'}
                              </td>
                              <td style={{ padding: '10px', fontWeight: '800', color: winner.fullCard ? 'var(--accent)' : 'var(--text-muted)' }}>
                                {winner.fullCard ? '🏆 دمبلة' : 'غير فائزة'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => setAllWinners(null)} className="btn btn-primary">
                      إغلاق التقرير
                    </button>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

      </div>

      <style>{`
        .board-number-cell {
          transition: all 0.15s ease-in-out;
        }
        .board-number-cell.undrawn:hover {
          background-color: var(--primary-light) !important;
          color: var(--primary) !important;
          transform: scale(1.08);
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
      `}</style>
    </>
  );
}
