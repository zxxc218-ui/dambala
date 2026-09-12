'use client';

import { useEffect, useRef, useState } from 'react';
import { parseScan } from '@/lib/scan';

/**
 * Listens for a barcode scanner anywhere on the page.
 *
 * A scanner is a keyboard that types very fast, so this watches the window
 * rather than an input box: the caller never has to remember to click into a
 * field first, which is the whole point when one hand is holding a ball.
 *
 * Two things keep it out of the way:
 *  - while a real input is focused, keystrokes are left alone, so typing a
 *    number by hand still works with the scanner switched on;
 *  - a scan is only accepted if the characters arrive together, so a person
 *    pressing "4" on the page is never mistaken for a scan.
 */

/** a scanner types a whole payload in well under this */
const BURST_MS = 120;
/** how long the last scan stays on screen */
const FEEDBACK_MS = 1400;

interface Options {
  enabled: boolean;
  onScan: (ball: number) => void;
}

export interface ScanFeedback {
  ball: number | null;
  /** the raw text, when it could not be read as a ball */
  rejected: string | null;
}

export default function useBallScanner({ enabled, onScan }: Options): ScanFeedback {
  const [feedback, setFeedback] = useState<ScanFeedback>({ ball: null, rejected: null });

  // kept in refs so the listener never needs re-binding mid-burst
  const buffer = useRef('');
  const lastKeyAt = useRef(0);
  // The callback is held in a ref so a new one on every render does not tear
  // down and re-bind the listener in the middle of a scan burst.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    let clearFeedback: ReturnType<typeof setTimeout> | undefined;

    const show = (next: ScanFeedback) => {
      setFeedback(next);
      clearTimeout(clearFeedback);
      clearFeedback = setTimeout(() => setFeedback({ ball: null, rejected: null }), FEEDBACK_MS);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable);
      if (typing) return;

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      // a gap means a new payload, not a continuation of the old one
      if (now - lastKeyAt.current > BURST_MS) buffer.current = '';
      lastKeyAt.current = now;

      if (e.key === 'Enter' || e.key === 'Tab') {
        const raw = buffer.current;
        buffer.current = '';
        if (raw.length < 2) return; // a lone keypress is not a scan

        const ball = parseScan(raw);
        if (ball !== null) {
          e.preventDefault();
          show({ ball, rejected: null });
          onScanRef.current(ball);
        } else {
          show({ ball: null, rejected: raw.slice(0, 24) });
        }
        return;
      }

      if (e.key.length === 1) {
        buffer.current = (buffer.current + e.key).slice(-24);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(clearFeedback);
      buffer.current = '';
    };
  }, [enabled]);

  return feedback;
}
