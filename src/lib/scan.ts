/**
 * Reading a ball's sticker.
 *
 * A handheld scanner behaves like a keyboard: it types the payload and usually
 * presses Enter. So the payload has to be something a keyboard can type, and
 * loose enough that a scanner configured to strip the prefix still works.
 *
 * Accepted: DMB7 · dmb-07 · 7 · 007
 */

export const SCAN_PREFIX = 'DMB';

export function parseScan(raw: string): number | null {
  const text = (raw || '').trim().toUpperCase();
  if (!text) return null;

  // strip our prefix and any separator the scanner may add
  const digits = text.startsWith(SCAN_PREFIX)
    ? text.slice(SCAN_PREFIX.length).replace(/^[-_:\s]+/, '')
    : text;

  if (!/^\d{1,3}$/.test(digits)) return null;

  const n = parseInt(digits, 10);
  return n >= 1 && n <= 90 ? n : null;
}
