'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';

/**
 * The drum — one connected object.
 *
 * A round glass bowl holds all 90 balls. Drawing one — by tapping it or by
 * pulling a random one — makes that ball fly out, drop through the neck under
 * the bowl, land as the big ball, and settle in the tray attached below. The
 * socket it left stays empty, so the bowl visibly empties as the game runs and
 * an undo puts the ball back in it.
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

/* --------------------------------------------------------------------------
 * Where each ball sits inside the round bowl.
 *
 * Balls are laid out in rings from the rim inwards, each ring starting at the
 * top and running clockwise, and the numbers stay in order — so a specific
 * number can still be found by eye, which a jumbled tombola would not allow.
 * Everything is a fraction of the bowl's width, so the layout is the same at
 * any size.
 * ----------------------------------------------------------------------- */

/** ball diameter, as a fraction of the bowl */
const BALL = 0.084;
/** breathing room between rings and between neighbours in a ring */
const GAP = 1.03;

interface Seat {
  n: number;
  /** centre, as a percentage of the bowl box */
  x: number;
  y: number;
}

/**
 * Server and client must serialise these percentages to the same string, or
 * React reports a hydration mismatch and stops patching the tree.
 */
const round = (v: number) => Math.round(v * 1000) / 1000;

function buildSeats(total: number): Seat[] {
  // ring radii, from the rim inwards
  const radii: number[] = [];
  let r = 0.5 - BALL / 2 - 0.024; // clearance so no ball touches the glass // keep the outer ring off the glass
  while (r > BALL * 0.6) {
    radii.push(r);
    r -= BALL * GAP;
  }

  const capacity = radii.map((rr) => Math.max(1, Math.floor((2 * Math.PI * rr) / (BALL * GAP))));
  const total_capacity = capacity.reduce((a, b) => a + b, 0);

  // Spread the balls across every ring in proportion to its circumference
  // rather than packing the rim full first, which would leave the middle empty.
  const perRing = capacity.map((c) => Math.floor((total * c) / total_capacity));
  let spare = total - perRing.reduce((a, b) => a + b, 0);
  for (let i = 0; spare > 0; i = (i + 1) % perRing.length) {
    if (perRing[i] < capacity[i]) {
      perRing[i]++;
      spare--;
    }
  }

  const seats: Seat[] = [];
  let n = 0;
  radii.forEach((rr, ring) => {
    for (let i = 0; i < perRing[ring]; i++) {
      // start at 12 o'clock, run clockwise
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / perRing[ring];
      seats.push({
        n: ++n,
        x: round((0.5 + rr * Math.cos(angle)) * 100),
        y: round((0.5 + rr * Math.sin(angle)) * 100),
      });
    }
  });

  return seats;
}

const SEATS = buildSeats(90);

/**
 * The bowl is fluid but capped, so the number inside a ball is sized off the
 * viewport and clamped at both ends rather than measured every resize.
 */
const BALL_FONT = 'clamp(9px, 3.1vw, 17px)';

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
  const neckRef = useRef<HTMLDivElement | null>(null);
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
    const source = ballRefs.current.get(latest) ?? neckRef.current;
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

        {/* ------------------------------- the bowl ------------------------------- */}
        <div
          className="relative w-full max-w-[340px] aspect-square rounded-full"
          style={{
            background:
              'radial-gradient(circle at 34% 20%, #1c2740 0%, #111b2c 55%, #0a1120 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.07), inset 0 12px 28px rgba(0,0,0,0.45),' +
              ' 0 0 0 1px rgba(148,163,184,0.16), 0 0 0 5px rgba(15,23,42,0.9),' +
              ' 0 0 0 6px rgba(148,163,184,0.07), 0 10px 26px rgba(0,0,0,0.4)',
          }}
        >
          {/* the sheen on the glass */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 30% 16%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 20%, rgba(255,255,255,0) 42%)',
            }}
          />

          {SEATS.map((seat) => {
            const isDrawn = drawnSet.has(seat.n);
            const isLatest = latest === seat.n;

            const common = {
              ref: (el: HTMLElement | null) => {
                ballRefs.current.set(seat.n, el);
              },
              style: {
                left: `${seat.x}%`,
                top: `${seat.y}%`,
                width: `${BALL * 100}%`,
                height: `${BALL * 100}%`,
                fontSize: BALL_FONT,
              } as React.CSSProperties,
            };

            if (isDrawn) {
              // the socket the ball left behind
              return (
                <div
                  key={seat.n}
                  ref={common.ref as any}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-black ${
                    isLatest
                      ? 'bg-emerald-500/10 text-emerald-500/60 ring-1 ring-emerald-500/25'
                      : 'bg-slate-950/70 text-slate-800'
                  }`}
                  style={{
                    ...common.style,
                    boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.6)',
                  }}
                >
                  {seat.n}
                </div>
              );
            }

            return (
              <button
                key={seat.n}
                ref={common.ref as any}
                onClick={() => onPick(seat.n)}
                disabled={!active}
                aria-label={`اسحب الرقم ${seat.n}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-black text-slate-900 transition-transform active:scale-90 hover:scale-110 hover:z-10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
                style={{
                  ...common.style,
                  background: BALL_SURFACE,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.45)',
                }}
              >
                {seat.n}
              </button>
            );
          })}
        </div>

        {/* ------------------------- the neck under the bowl ------------------------- */}
        <div
          ref={neckRef}
          className="relative -mt-px w-12 h-5 border-x border-slate-700/60"
          style={{
            background: 'linear-gradient(180deg, #070b13 0%, #0b1220 100%)',
            clipPath: 'polygon(0 0, 100% 0, 80% 100%, 20% 100%)',
          }}
        />

        {/* ------------------------ the ball that just dropped ------------------------ */}
        <div
          ref={sphereRef}
          className="relative rounded-full flex items-center justify-center -mt-1"
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

      <div className="flex flex-col gap-2 w-full max-w-[340px] mt-4">
        <button
          onClick={onRandom}
          disabled={drawing || !active || remaining === 0}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black py-3 px-6 rounded-xl text-sm transition-all active:scale-[0.98] cursor-pointer"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          {drawing ? 'جاري السحب...' : 'اسحب كرة'}
        </button>

        <button
          onClick={onUndo}
          disabled={undoing || drawnSet.size === 0}
          className="w-full flex items-center justify-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-400 disabled:opacity-35 disabled:cursor-not-allowed font-bold py-2.5 px-4 rounded-xl text-[11px] transition-all active:scale-[0.98] cursor-pointer"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <Undo2 size={14} />
          {undoing ? 'جاري الإلغاء...' : latest ? `رجّع آخر كرة (${latest})` : 'رجّع آخر كرة'}
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

        {/* --------------- the tray at the end of the drum, attached to it --------------- */}
        <div className="w-full mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2.5">
            <h4
              className="text-[11px] font-bold text-slate-300"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              الكرات النازلة
            </h4>
            <span className="text-[10px] font-bold text-slate-400 font-mono">
              {drawnSet.size} / 90
            </span>
          </div>

          {recent.length === 0 ? (
            <p
              className="text-slate-500 text-[11px] text-center py-3"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              الدورق ممتلئ — دوس كرة أو اسحب وحدة.
            </p>
          ) : (
            <div
              className="flex flex-wrap gap-1.5 rounded-xl bg-slate-950/50 p-2.5"
              style={{ direction: 'ltr', boxShadow: 'inset 0 2px 7px rgba(0,0,0,0.4)' }}
            >
              {recent.map((n) => {
                const isLatest = n.number === latest;
                return (
                  <div
                    key={n.drawOrder}
                    title={`الكرة رقم ${n.drawOrder} بالترتيب`}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-slate-900 ${
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
              })}
            </div>
          )}
        </div>
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
