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
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
