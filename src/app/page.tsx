import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Navbar from '@/components/Navbar';
import { Play, Award, Printer, LayoutGrid, FileUp, ShieldAlert, CheckCircle2, HelpCircle } from 'lucide-react';

export const revalidate = 0; // Disable caching to always reflect DB state

export default async function Home() {
  let setsCount = 0;
  let activeSession = null;

  try {
    setsCount = await prisma.set.count();
    activeSession = await prisma.drawSession.findFirst({
      where: {
        status: { in: ['active', 'paused'] }
      }
    });
  } catch (err) {
    console.error('Error fetching database count:', err);
  }

  return (
    <>
      <Navbar />
      <div className="container" style={{ padding: '40px 16px', maxWidth: '1000px' }}>
        
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: '800', color: 'var(--text)', marginBottom: '16px' }}>
            نظام إدارة وتشغيل لعبة الدمبلة العراقية
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 24px' }}>
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
              fontSize: '14px'
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
            gap: '16px'
          }}>
            <ShieldAlert size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h3 style={{ fontWeight: '700', marginBottom: '6px' }}>قاعدة البيانات فارغة!</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.6' }}>
                لم يتم رفع أي سيتات أو بطاقات دمبلة إلى قاعدة البيانات حتى الآن.
                يرجى تسجيل الدخول كمسؤول (Admin) عن طريق الزر في الأعلى بكلمة مرور الافتراضية <strong>admin123</strong>، 
                ثم التوجه لصفحة <strong>"استيراد CSV"</strong> لرفع ملف السيتات والتحقق من صحته.
              </p>
              <div style={{ marginTop: '12px' }}>
                <Link href="/login" className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '13px', background: '#856404', color: 'white' }}>
                  تسجيل الدخول كمسؤول
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
            gap: '12px'
          }}>
            <CheckCircle2 size={20} />
            <span style={{ fontWeight: '700', fontSize: '15px' }}>
              النظام جاهز للتشغيل. قاعدة البيانات تحتوي على <strong>{setsCount}</strong> سيت دمبلة ({setsCount * 6} بطاقة).
            </span>
          </div>
        )}

        {/* Dashboard Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          
          {/* Card 1: Play */}
          <Link href="/play" className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>تشغيل اللعبة والسحب</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
                سحب الأرقام من 1 إلى 90 بدون تكرار في نفس الجلسة، مع إمكانية الإيقاف المؤقت وعرض الأرقام المتبقية والمسحوبة.
              </p>
            </div>
          </Link>

          {/* Card 2: Check Winner */}
          <Link href="/check-winner" className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--secondary-light)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>فحص الفائز والبطاقة</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
                إدخال رقم السيت والبطاقة لعرضها وتلوين الأرقام المسحوبة آلياً، والتحقق من اكتمال الأسطر أو البطاقة كاملة.
              </p>
            </div>
          </Link>

          {/* Card 3: Print */}
          <Link href="/print" className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fff2e6', color: '#ff9f43', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Printer size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>طباعة وتصدير الكروت</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
                تصدير سيتات الدمبلة لملفات PDF جاهزة للطباعة على ورق A4 بخيار (6 بطاقات بالصفحة) أو (بطاقة واحدة كبيرة).
              </p>
            </div>
          </Link>

          {/* Card 4: Manage Sets */}
          <Link href="/admin/sets" className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ebf3ff', color: '#3867d6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutGrid size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>إدارة السيتات والتعديل</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
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
          fontSize: '14px'
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
