'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';

/**
 * The drum — one connected object.
 *
 * A glass box holds all 90 balls, laid out 1-90 in reading order. Drawing one —
 * by tapping it or by pulling a random one — makes that ball fly out, land as
 * the big ball beside the box, and settle in the tray next to it. The socket it
 * left stays empty, so the box visibly empties as the game runs and an undo
 * puts the ball back in it.
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
const SPHERE = 92;

/** One ball surface, used in the bowl, in flight, and where it lands. */
const BALL_SURFACE =
  'radial-gradient(circle at 32% 28%, #ffffff 0%, #e2e8f0 42%, #94a3b8 100%)';


/**
 * The box is fluid but capped, so the number inside a ball is sized off the
 * viewport and clamped at both ends rather than measured on every resize.
 */
const BALL_FONT = 'clamp(8px, 2.6vw, 13px)';

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
  const bowlRef = useRef<HTMLDivElement | null>(null);
  const ballRefs = useRef(new Map<number, HTMLElement | null>());

  const [flights, setFlights] = useState<Flight[]>([]);
  const flightId = useRef(0);

  const drawnNumbers = drawn.map((d) => d.number);
  const drawnSet = new Set(drawnNumbers);
  const remaining = 90 - drawnSet.size;

  /** A ball is mid-air, so the big ball holds its number back until it lands. */
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
    const source = ballRefs.current.get(latest) ?? bowlRef.current;
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
    <div ref={stageRef} className="relative flex flex-col gap-3">
      {/* ===================== bowl → neck → ball → tray, one body ==================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center">
        <div className="flex items-baseline justify-between w-full mb-3">
          <h3
            className="text-[11px] font-bold text-slate-300"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            الدورق
          </h3>
          <span
            className="text-[10px] font-bold text-slate-500"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            باقي <span className="text-slate-300 font-mono">{remaining}</span>
          </span>
        </div>

        {/* ------------------------------- the box ------------------------------- */}
        <div
          ref={bowlRef}
          className="relative w-full max-w-[340px] rounded-2xl p-3"
          style={{
            background:
              'radial-gradient(120% 90% at 34% 12%, #1c2740 0%, #111b2c 55%, #0a1120 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.07), inset 0 10px 24px rgba(0,0,0,0.45),' +
              ' 0 0 0 1px rgba(148,163,184,0.16), 0 0 0 5px rgba(15,23,42,0.9),' +
              ' 0 0 0 6px rgba(148,163,184,0.07), 0 10px 26px rgba(0,0,0,0.4)',
          }}
        >
          {/* the sheen on the glass */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background:
                'linear-gradient(155deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 22%, rgba(255,255,255,0) 46%)',
            }}
          />

          {/* 1-90 in reading order, so any number is where the eye expects it */}
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
                    className={`aspect-square w-full rounded-full flex items-center justify-center font-black ${
                      isLatest
                        ? 'bg-emerald-500/10 text-emerald-500/60 ring-1 ring-emerald-500/25'
                        : 'bg-slate-950/70 text-slate-800'
                    }`}
                    style={{ fontSize: BALL_FONT, boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.6)' }}
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
                  className="aspect-square w-full rounded-full flex items-center justify-center font-black text-slate-900 transition-transform active:scale-90 hover:scale-110 hover:z-10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
                  style={{
                    fontSize: BALL_FONT,
                    background: BALL_SURFACE,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.45)',
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        {/* ------ the ball that dropped, and beside it the ones already out ------ */}
        <div className="w-full max-w-[340px] mt-3 flex items-stretch gap-3">
          <div
            ref={sphereRef}
            className="relative rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              width: SPHERE,
              height: SPHERE,
              background: latest
                ? BALL_SURFACE
                : 'radial-gradient(circle at 32% 28%, #1e293b 0%, #0f172a 60%, #020617 100%)',
              boxShadow: latest
                ? '0 6px 18px rgba(0,0,0,0.45), 0 0 0 3px rgba(16,185,129,0.16)'
                : 'inset 0 3px 10px rgba(0,0,0,0.6), 0 0 0 3px rgba(30,41,59,0.5)',
            }}
          >
            {latest && !inFlight ? (
              <span className="text-slate-900 font-mono font-black text-4xl tracking-tighter animate-[popIn_0.25s_cubic-bezier(0.175,0.885,0.32,1.275)]">
                {latest}
              </span>
            ) : latest ? (
              <span className="opacity-0 text-4xl font-black">{latest}</span>
            ) : (
              <span className="text-slate-700 text-4xl font-black">-</span>
            )}
          </div>

          {/* The balls already out sit in the room beside the big one rather than
              in a block under it, which is a whole section of scrolling saved. */}
          <div className="flex-1 min-w-0 flex flex-col" style={{ height: SPHERE }}>
            <div className="flex items-baseline justify-between mb-1">
              <h4
                className="text-[10px] font-bold text-slate-400"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                النازلة
              </h4>
              <span className="text-[10px] font-bold text-slate-500 font-mono">
                {drawnSet.size}/90
              </span>
            </div>

            <div
              className="flex-1 flex flex-wrap gap-1 content-start rounded-xl bg-slate-950/50 p-1.5 overflow-y-auto"
              style={{ direction: 'ltr', boxShadow: 'inset 0 2px 7px rgba(0,0,0,0.4)' }}
            >
              {recent.length === 0 ? (
                <span
                  className="w-full self-center text-center text-[10px] text-slate-600"
                  style={{ direction: 'rtl', fontFamily: 'Cairo, sans-serif' }}
                >
                  ما نزلت ولا كرة
                </span>
              ) : (
                recent.map((n) => {
                  const isLatest = n.number === latest;
                  return (
                    <div
                      key={n.drawOrder}
                      title={`الكرة رقم ${n.drawOrder} بالترتيب`}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-slate-900 ${
                        isLatest ? 'ring-2 ring-amber-400 animate-[popIn_0.25s_ease-out]' : ''
                      }`}
                      style={{
                        background: isLatest
                          ? 'radial-gradient(circle at 32% 28%, #fef3c7 0%, #fcd34d 45%, #f59e0b 100%)'
                          : 'radial-gradient(circle at 32% 28%, #d1fae5 0%, #6ee7b7 45%, #10b981 100%)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
                      }}
                    >
                      {n.number}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* two controls in one row, so nothing is pushed off the first screen */}
        <div className="flex gap-2 w-full max-w-[340px] mt-3">
          <button
            onClick={onRandom}
            disabled={drawing || !active || remaining === 0}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black py-3 px-4 rounded-xl text-sm transition-all active:scale-[0.98] cursor-pointer"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {drawing ? 'جاري السحب...' : 'اسحب كرة'}
          </button>

          <button
            onClick={onUndo}
            disabled={undoing || drawnSet.size === 0}
            aria-label="رجّع آخر كرة"
            className="flex items-center justify-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-400 disabled:opacity-35 disabled:cursor-not-allowed font-bold py-3 px-4 rounded-xl text-[11px] transition-all active:scale-[0.98] cursor-pointer flex-shrink-0"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            <Undo2 size={14} />
            {undoing ? '...' : latest ? `رجّع (${latest})` : 'رجّع'}
          </button>
        </div>

        {pendingCount > 0 && (
          <span
            className="mt-2 text-[10px] text-slate-500 font-bold"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            جاري الحفظ… ({pendingCount})
          </span>
        )}
      </div>
      {/* ============================== balls in mid-air ============================== */}
      {flights.map((f) => (
        <div
          key={f.id}
          aria-hidden
          className="absolute top-0 left-0 rounded-full flex items-center justify-center font-mono font-black text-slate-900 pointer-events-none z-30"
          style={{
            width: SPHERE,
            height: SPHERE,
            fontSize: 34,
            background: BALL_SURFACE,
            boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
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
