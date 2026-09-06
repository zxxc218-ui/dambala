'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * A side panel that slides in from the edge.
 *
 * Everything that is not the game itself lives in here, so the board keeps the
 * screen. It closes the way it opened — swipe it back towards the edge, tap
 * outside it, or press Escape.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** how far it has to be dragged before letting go actually closes it */
const DISMISS_PX = 90;

export default function Drawer({ open, onClose, title, subtitle, children }: Props) {
  /**
   * How far the finger has dragged it. The value is kept in a ref as well as in
   * state: a quick flick can deliver touchmove and touchend before React has
   * committed the new state, and the end handler would then read a stale 0 and
   * refuse to close.
   */
  const [drag, setDrag] = useState(0);
  const dragRef = useRef(0);
  const startX = useRef<number | null>(null);

  // Escape closes it, and the page behind it must not scroll while it is open.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      dragRef.current = 0;
      setDrag(0);
    }
  }, [open]);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    // it lives on the right edge, so only a drag back to the right counts
    const delta = Math.max(0, e.touches[0].clientX - startX.current);
    dragRef.current = delta;
    setDrag(delta);
  };

  const onTouchEnd = () => {
    if (dragRef.current > DISMISS_PX) onClose();
    dragRef.current = 0;
    setDrag(0);
    startX.current = null;
  };

  return (
    <>
      {/* what is behind it stays visible but out of reach */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={`fixed top-0 bottom-0 right-0 z-40 w-[86%] max-w-sm bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col ${
          open ? '' : 'pointer-events-none'
        }`}
        style={{
          transform: `translateX(${open ? drag : '100%'}${open ? 'px' : ''})`,
          transition: drag > 0 ? 'none' : 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* the grab handle — this is the thing you pull */}
        <div className="absolute top-1/2 -translate-y-1/2 right-1.5 w-1 h-14 rounded-full bg-slate-700/70 pointer-events-none" />

        <header className="flex items-start justify-between gap-3 p-4 pr-6 border-b border-slate-800">
          <div className="text-right">
            <h2
              className="text-sm font-black text-slate-100"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                className="text-[10px] text-slate-500 mt-0.5"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {subtitle}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="text-slate-500 hover:text-slate-200 transition-colors cursor-pointer p-1 -m-1"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 pr-6 flex flex-col gap-4">{children}</div>
      </aside>
    </>
  );
}
