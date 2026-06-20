'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CheckWinnerRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/check');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
  );
}
