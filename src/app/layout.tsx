import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  title: 'الدمبلة العراقية | إدارة وتشغيل اللعبة',
  description: 'نظام متكامل لإدارة وتشغيل لعبة الدمبلة العراقية وطباعة السيتات وفحص الفائزين',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="bg-slate-950 text-white min-h-screen overflow-x-hidden selection:bg-emerald-500 selection:text-slate-950">
        <div className="w-full max-w-[430px] mx-auto min-h-screen bg-slate-900 shadow-2xl relative flex flex-col justify-between overflow-x-hidden border-x border-slate-800 pb-20">
          <main className="flex-1 w-full">{children}</main>
        </div>
      </body>
    </html>
  );
}
