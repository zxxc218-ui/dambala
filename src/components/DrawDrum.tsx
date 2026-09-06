'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';

/**
 * The drum.
 *
 * All 90 balls sit in a glass drum. Drawing one — by tapping it or by pulling a
 * random one — makes that ball fly out of the drum, land in the display sphere,
 * and join the tray of numbers already called. The socket it left stays empty,
 * so the drum visibly empties as the game runs and an undo puts the ball back.
 *
 * The flight is decoration only: the number is registered the moment it is
 * picked, and the animation never delays the next tap.
 */

interface DrawnNumber {
  number: number;
  drawOrder: number;
}

interface Props {
  drawn: DrawnNumber[];
  latest: number | null;
  /** false while the session is paused — the drum locks */
  active: boolean;
  drawing: boolean;
  undoing: boolean;
  pendingCount: number;
  onPick: (n: number) => void;
  onRandom: () => void;
  onUndo: () => void;
}

interface Flight {
  id: number;
  number: number;
  /** start and end, relative to the stage box */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  scale0: number;
  /** flipped on the next frame to start the transition */
  live: boolean;
}

const FLIGHT_MS = 520;
const SPHERE = 128;

/** One ball surface, used in the drum, in flight, and where it lands. */
const BALL_SURFACE =
  'radial-gradient(circle at 32% 28%, #ffffff 0%, #e2e8f0 42%, #94a3b8 100%)';

export default function DrawDrum({
  drawn,
  latest,
  active,
  drawing,
  undoing,
  pendingCount,
  onPick,
  onRandom,
  onUndo,
}: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sphereRef = useRef<HTMLDivElement | null>(null);
  const mouthRef = useRef<HTMLDivElement | null>(null);
  const ballRefs = useRef(new Map<number, HTMLElement | null>());

  const [flights, setFlights] = useState<Flight[]>([]);
  const flightId = useRef(0);

  const drawnNumbers = drawn.map((d) => d.number);
  const drawnSet = new Set(drawnNumbers);
  const remaining = 90 - drawnSet.size;

  /** A ball is mid-air, so the sphere holds its number back until it lands. */
  const inFlight = flights.some((f) => f.number === latest);

  /**
   * Watch the board rather than the click: a number can arrive from a tap, from
   * the random button (which only knows the number once the server answers), or
   * from a re-sync. One rule covers all three.
   */
  const previous = useRef<{ count: number; latest: number | null }>({ count: -1, latest: null });

  useLayoutEffect(() => {
    const count = drawnNumbers.length;
    const before = previous.current;
    previous.current = { count, latest };

    // first paint, an undo, or a reset — nothing to launch
    if (before.count === -1 || count <= before.count || latest === null) return;

    const stage = stageRef.current;
    const sphere = sphereRef.current;
    if (!stage || !sphere) return;

    const stageBox = stage.getBoundingClientRect();
    const source = ballRefs.current.get(latest) ?? mouthRef.current;
    if (!source) return;

    const from = source.getBoundingClientRect();
    const to = sphere.getBoundingClientRect();

    const flight: Flight = {
      id: ++flightId.current,
      number: latest,
      x0: from.left - stageBox.left + from.width / 2 - SPHERE / 2,
      y0: from.top - stageBox.top + from.height / 2 - SPHERE / 2,
      x1: to.left - stageBox.left + to.width / 2 - SPHERE / 2,
      y1: to.top - stageBox.top + to.height / 2 - SPHERE / 2,
      scale0: Math.max(from.width / SPHERE, 0.12),
      live: false,
    };

    setFlights((list) => [...list, flight]);

    const raf = requestAnimationFrame(() =>
      setFlights((list) => list.map((f) => (f.id === flight.id ? { ...f, live: true } : f)))
    );
    const done = setTimeout(
      () => setFlights((list) => list.filter((f) => f.id !== flight.id)),
      FLIGHT_MS + 40
    );

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [latest, drawnNumbers.length]);

  // A ball that flew while the tab was hidden would otherwise hang around.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) setFlights([]);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const recent = [...drawn].sort((a, b) => b.drawOrder - a.drawOrder);

  return (
    <div ref={stageRef} className="relative flex flex-col gap-4">
      {/* ------------------------------ the drum ------------------------------ */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 pb-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3
            className="text-xs font-black text-slate-200 flex items-center gap-1.5"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <span className="text-base leading-none">🎰</span> الدورق
          </h3>
          <span
            className="text-[10px] font-bold text-slate-400"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            باقي <strong className="text-emerald-400 font-mono">{remaining}</strong> كرة
          </span>
        </div>

        {/* glass body */}
        <div
          className="relative rounded-[1.75rem] border-[3px] border-slate-700/70 p-3 pb-5 overflow-hidden w-full max-w-[520px] mx-auto"
          style={{
            background:
              'radial-gradient(120% 90% at 30% 0%, #1e293b 0%, #0b1220 55%, #060b17 100%)',
            boxShadow: 'inset 0 8px 24px rgba(0,0,0,0.55), inset 0 -6px 18px rgba(0,0,0,0.4)',
          }}
        >
          {/* sheen across the glass */}
          <div
            className="absolute inset-0 pointer-events-none rounded-[1.5rem]"
            style={{
              background:
                'linear-gradient(150deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 28%, rgba(255,255,255,0) 55%)',
            }}
          />

          <div className="grid grid-cols-10 gap-1 relative" style={{ direction: 'ltr' }}>
            {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => {
              const isDrawn = drawnSet.has(n);
              const isLatest = latest === n;

              if (isDrawn) {
                // the socket the ball left behind
                return (
                  <div
                    key={n}
                    ref={(el) => {
                      ballRefs.current.set(n, el);
                    }}
                    className={`aspect-square w-full rounded-full flex items-center justify-center text-[10px] font-black ${
                      isLatest
                        ? 'bg-emerald-500/15 text-emerald-500/70 ring-1 ring-emerald-500/30'
                        : 'bg-slate-950/80 text-slate-700'
                    }`}
                    style={{ boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.6)' }}
                  >
                    {n}
                  </div>
                );
              }

              return (
                <button
                  key={n}
                  ref={(el) => {
                    ballRefs.current.set(n, el);
                  }}
                  onClick={() => onPick(n)}
                  disabled={!active}
                  aria-label={`اسحب الرقم ${n}`}
                  className="aspect-square w-full rounded-full flex items-center justify-center text-[11px] font-black text-slate-900 transition-transform active:scale-90 hover:scale-105 cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
                  style={{
                    background: BALL_SURFACE,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.45)',
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>

          {/* the chute the balls drop through */}
          <div
            ref={mouthRef}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-3 rounded-t-lg bg-slate-950 border-t-2 border-x-2 border-slate-700/70"
          />
        </div>

        {/* the ball that just came out */}
        <div className="flex flex-col items-center -mt-1 pb-4">
          <div
            ref={sphereRef}
            className="relative rounded-full flex items-center justify-center"
            style={{
              width: SPHERE,
              height: SPHERE,
              background: latest
                ? BALL_SURFACE
                : 'radial-gradient(circle at 32% 28%, #1e293b 0%, #0f172a 60%, #020617 100%)',
              boxShadow: latest
                ? '0 10px 28px rgba(0,0,0,0.55), 0 0 0 4px rgba(16,185,129,0.18)'
                : 'inset 0 4px 14px rgba(0,0,0,0.7), 0 0 0 4px rgba(30,41,59,0.6)',
            }}
          >
            {latest && !inFlight ? (
              <span className="text-slate-900 font-mono font-black text-5xl tracking-tighter animate-[popIn_0.25s_cubic-bezier(0.175,0.885,0.32,1.275)]">
                {latest}
              </span>
            ) : latest ? (
              <span className="opacity-0 text-5xl font-black">{latest}</span>
            ) : (
              <span className="text-slate-700 text-5xl font-black">-</span>
            )}
            {latest && (
              <div className="absolute -inset-1 rounded-full border border-emerald-500/25 animate-ping opacity-30 pointer-events-none" />
            )}
          </div>

          <span
            className="mt-2 text-[10px] font-bold text-slate-500"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {latest ? `آخر كرة نزلت · طلع ${drawnSet.size} من 90` : 'الدورق ممتلئ — دوس كرة أو اسحب'}
          </span>
        </div>
      </div>

      {/* ------------------------------ controls ------------------------------ */}
      <div className="flex flex-col gap-2">
        <button
          onClick={onRandom}
          disabled={drawing || !active || remaining === 0}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black py-4 px-6 rounded-2xl text-base transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/10 cursor-pointer"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          {drawing ? 'جاري سحب كرة...' : 'سحب كرة من الدورق 🎲'}
        </button>

        <button
          onClick={onUndo}
          disabled={undoing || drawnSet.size === 0}
          className="w-full flex items-center justify-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-400 disabled:opacity-35 disabled:cursor-not-allowed font-black py-2.5 px-4 rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <Undo2 size={14} />
          {undoing
            ? 'جاري الإلغاء...'
            : latest
            ? `رجّع آخر كرة (${latest})`
            : 'رجّع آخر كرة'}
        </button>

        {pendingCount > 0 && (
          <span
            className="text-center text-[10px] text-slate-500 font-bold"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            جاري الحفظ… ({pendingCount})
          </span>
        )}
      </div>

      {/* ------------------------- the balls that came out ------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-xs font-black text-slate-200"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            الكرات النازلة
          </h3>
          <span className="text-[10px] font-bold text-slate-400 font-mono">
            {drawnSet.size} / 90
          </span>
        </div>

        {recent.length === 0 ? (
          <p
            className="text-slate-500 text-xs text-center py-3"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            الدورق ممتلئ — ما نزلت ولا كرة بعد.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5" style={{ direction: 'ltr' }}>
            {recent.map((n) => {
              const isLatest = n.number === latest;
              return (
                <div
                  key={n.drawOrder}
                  title={`الكرة رقم ${n.drawOrder} بالترتيب`}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-black ${
                    isLatest
                      ? 'ring-2 ring-amber-400 text-slate-900 animate-[popIn_0.25s_ease-out]'
                      : 'text-slate-900'
                  }`}
                  style={{
                    background: isLatest
                      ? 'radial-gradient(circle at 32% 28%, #fef3c7 0%, #fcd34d 45%, #f59e0b 100%)'
                      : 'radial-gradient(circle at 32% 28%, #d1fae5 0%, #6ee7b7 45%, #10b981 100%)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                  }}
                >
                  {n.number}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --------------------------- balls in mid-air --------------------------- */}
      {flights.map((f) => (
        <div
          key={f.id}
          aria-hidden
          className="absolute top-0 left-0 rounded-full flex items-center justify-center font-mono font-black text-slate-900 pointer-events-none z-30"
          style={{
            width: SPHERE,
            height: SPHERE,
            fontSize: 44,
            background: BALL_SURFACE,
            boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
            transform: f.live
              ? `translate(${f.x1}px, ${f.y1}px) scale(1) rotate(0deg)`
              : `translate(${f.x0}px, ${f.y0}px) scale(${f.scale0}) rotate(-140deg)`,
            transition: `transform ${FLIGHT_MS}ms cubic-bezier(0.34, 1.2, 0.5, 1)`,
          }}
        >
          {f.number}
        </div>
      ))}
    </div>
  );
}
