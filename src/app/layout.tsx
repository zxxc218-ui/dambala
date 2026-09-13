import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import ThemeProvider, { THEME_BOOT_SCRIPT } from '@/components/ThemeProvider';
import OfflineReady from '@/components/OfflineReady';
import InstallApp from '@/components/InstallApp';

const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  title: 'الدمبلة العراقية | إدارة وتشغيل اللعبة',
  description: 'نظام متكامل لإدارة وتشغيل لعبة الدمبلة العراقية وطباعة السيتات وفحص الفائزين',
  manifest: '/manifest.webmanifest',
  applicationName: 'دمبلة',
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'دمبلة',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // The installed app fills the screen; the bar has to match the page or it
  // reads as a browser again.
  themeColor: '#0b1120',
  viewportFit: 'cover' as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <head>
        {/* Paints the saved theme before the first frame, so the page never
            flashes the wrong one on the way in. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen overflow-x-hidden selection:bg-emerald-500 selection:text-ink-fixed">
        <OfflineReady />
        <ThemeProvider>
          <div className="app-shell w-full max-w-[430px] md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[1560px] mx-auto min-h-screen bg-slate-900 shadow-2xl relative flex flex-col justify-between overflow-x-hidden border-x border-slate-800 pb-20 md:pb-10">
            <InstallApp />
            <main className="flex-1 w-full">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
