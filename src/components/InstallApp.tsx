'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

/**
 * The offer to install the app.
 *
 * Installing is what makes the offline story real: an installed app opens from
 * the home screen with no browser bar, keeps its own storage, and starts with
 * no connection at all. So it is worth one quiet line at the top of the screen
 * — and worth never showing again once it has been refused.
 *
 * Chrome, Edge and Android hand us an event we can turn into a real install
 * button. iOS gives nothing, so there the line explains the two taps instead,
 * since there is no way to do it for the user.
 */

const DISMISSED = 'dambala_install_dismissed';

interface PromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS reports it here instead
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstallApp() {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISSED)) return;
    } catch {
      // storage blocked; showing the line once is no loss
    }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it, so the button can fire it on a real tap
      setPrompt(e as PromptEvent);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);

    // Safari never fires that event, so offer the manual route there. This is
    // the one thing here that cannot be decided while rendering: it depends on
    // the browser and on this device's storage, neither of which exists when
    // the page is rendered on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIOS()) setShow(true);

    const onInstalled = () => setShow(false);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {
      // nothing to do
    }
  };

  const install = async () => {
    if (!prompt) {
      setIosHint(true);
      return;
    }
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setPrompt(null);
  };

  if (!show) return null;

  return (
    <div
      className="mx-3 mt-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5 flex items-center gap-2.5"
      style={{ fontFamily: 'Cairo, sans-serif' }}
    >
      <Download size={16} className="text-emerald-400 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-black text-emerald-400">ثبّت دمبلة على هذا الجهاز</p>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          {iosHint
            ? 'دوس زر المشاركة بالأسفل، وبعدين «إضافة إلى الشاشة الرئيسية».'
            : 'تفتحه بأيقونة، ويشتغل كامل بدون نت.'}
        </p>
      </div>

      <button
        onClick={install}
        className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-emerald-500 text-ink-fixed text-[10px] font-black cursor-pointer flex-shrink-0 hover:bg-emerald-600 transition-colors"
      >
        {prompt ? 'تثبيت' : <><Share size={11} /> شلون؟</>}
      </button>

      <button
        onClick={dismiss}
        aria-label="إخفاء"
        className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer flex-shrink-0"
      >
        <X size={15} />
      </button>
    </div>
  );
}
