import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Play, Award, Printer, LayoutGrid, ShieldAlert, CheckCircle2, Tv } from 'lucide-react';

export const revalidate = 0; // Disable caching to always reflect DB state

export default async function Home() {
  let setsCount = 0;
  let activeSession = null;

  try {
    const { count, error: countErr } = await supabase
      .from('sets')
      .select('*', { count: 'exact', head: true });
    
    if (!countErr) {
      setsCount = count || 0;
    }

    const { data: sessionRecord, error: sessionErr } = await supabase
      .from('draw_sessions')
      .select('name')
      .in('status', ['active', 'paused'])
      .maybeSingle();

    if (!sessionErr && sessionRecord) {
      activeSession = sessionRecord;
    }
  } catch (err) {
    console.error('Error fetching database count from Supabase:', err);
  }

  return (
    <>
      <Navbar />
      <div className="container" style={{ padding: '40px 16px', maxWidth: '1000px' }}>
        
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: '800', color: 'var(--text)', marginBottom: '16px', fontFamily: 'Cairo, sans-serif' }}>
            نظام إدارة وتشغيل لعبة الدمبلة العراقية
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 24px', fontFamily: 'Cairo, sans-serif' }}>
            لوحة تحكم كاملة للتحقق من أرقام السيتات، تشغيل جولات السحب العشوائي، وفحص فوز البطاقات فورياً مع ميزة الطباعة بجودة عالية.
          </p>

          {activeSession ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              borderRadius: '20px',
              fontWeight: '700',
              fontSize: '14px',
              fontFamily: 'Cairo, sans-serif'
            }}>
              <span className="pulse-dot"></span>
              هناك جلسة سحب جارية حالياً: {activeSession.name}
            </div>
          ) : null}
        </div>

        {/* Database Status Alert */}
        {setsCount === 0 ? (
          <div style={{
            background: '#fff3cd',
            border: '1px solid #ffeeba',
            color: '#856404',
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            direction: 'rtl'
          }}>
            <ShieldAlert size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h3 style={{ fontWeight: '700', marginBottom: '6px', fontFamily: 'Cairo, sans-serif' }}>قاعدة البيانات فارغة!</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.6', fontFamily: 'Cairo, sans-serif' }}>
                لم يتم رفع أي سيتات أو بطاقات دمبلة إلى قاعدة بيانات Supabase حتى الآن.
                يرجى تسجيل الدخول كمسؤول (Admin) لتعبئة البطاقات يدوياً أو استيرادها من ملف CSV.
              </p>
              <div style={{ marginTop: '12px' }}>
                <Link href="/login" className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '13px', background: '#856404', color: 'white', fontFamily: 'Cairo, sans-serif' }}>
                  تسجيل الدخول للنظام
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--primary-light)',
            border: '1px solid rgba(16, 172, 132, 0.2)',
            color: 'var(--primary)',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            direction: 'rtl'
          }}>
            <CheckCircle2 size={20} />
            <span style={{ fontWeight: '700', fontSize: '15px', fontFamily: 'Cairo, sans-serif' }}>
              النظام جاهز للتشغيل. قاعدة البيانات السحابية تحتوي على <strong>{setsCount}</strong> سيت دمبلة ({setsCount * 6} بطاقة).
            </span>
          </div>
        )}

        {/* Dashboard Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          direction: 'rtl'
        }}>
          
          {/* Card 1: Play */}
          <Link href="/play" className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', fontFamily: 'Cairo, sans-serif' }}>تشغيل اللعبة والسحب</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', fontFamily: 'Cairo, sans-serif' }}>
                سحب الأرقام من 1 إلى 90 بدون تكرار في نفس الجلسة، مع إمكانية الإيقاف المؤقت وعرض الأرقام المتبقية والمسحوبة.
              </p>
            </div>
          </Link>

          {/* Card 2: Check Winner */}
          <Link href="/check" className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--secondary-light)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', fontFamily: 'Cairo, sans-serif' }}>فحص الفائز والبطاقة</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', fontFamily: 'Cairo, sans-serif' }}>
                إدخال رقم السيت والبطاقة لعرضها وتلوين الأرقام المسحوبة آلياً، والتحقق من اكتمال الأسطر أو البطاقة كاملة.
              </p>
            </div>
          </Link>

          {/* Card 3: Display TV */}
          <Link href="/display" className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0f2f1', color: '#009688', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tv size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', fontFamily: 'Cairo, sans-serif' }}>شاشة عرض التلفزيون</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', fontFamily: 'Cairo, sans-serif' }}>
                شاشة عرض خالية من الأزرار ومريحة بصرياً لعرض الرقم الأخير والمسحوبات على بروجكتر أو تلفاز شاشة كبيرة.
              </p>
            </div>
          </Link>

          {/* Card 4: Manage Sets */}
          <Link href="/admin" className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ebf3ff', color: '#3867d6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutGrid size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', fontFamily: 'Cairo, sans-serif' }}>إدارة السيتات والتعديل</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', fontFamily: 'Cairo, sans-serif' }}>
                استعراض السيتات الـ 150 والتعديل اليدوي على أرقام الخلايا داخل البطاقات مع تفعيل الفحص التلقائي بعد التعديل.
              </p>
            </div>
          </Link>

        </div>

        {/* Footer/Info section */}
        <div style={{
          marginTop: '64px',
          borderTop: '1px solid var(--border)',
          paddingTop: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '14px',
          fontFamily: 'Cairo, sans-serif'
        }}>
          لعبة الدمبلة العراقية / Tambola | نظام ويب كامل لإدارة اللعبة
        </div>

      </div>

      <style>{`
        .pulse-dot {
          width: 8px;
          height: 8px;
          background-color: var(--primary);
          border-radius: 50%;
          display: inline-block;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 1; box-shadow: 0 0 0 0 rgba(16, 172, 132, 0.7); }
          70% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 0 8px rgba(16, 172, 132, 0); }
          100% { transform: scale(0.9); opacity: 1; box-shadow: 0 0 0 0 rgba(16, 172, 132, 0); }
        }
      `}</style>
    </>
  );
}
