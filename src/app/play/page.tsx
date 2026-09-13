'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import {
  Play,
  Pause,
  RotateCcw,
  Award,
  Sparkles,
  Loader2,
  X,
  Gift,
  Check,
  SlidersHorizontal,
  ScanLine,
  QrCode,
  WifiOff,
  CloudUpload,
  CloudOff,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import DrawDrum from '@/components/DrawDrum';
import useBallScanner from '@/components/useBallScanner';
import useOnline from '@/components/useOnline';
import useGame from '@/components/useGame';
import { computeStandings, orderMap, toStatus } from '@/lib/prizes';
import { WIN_LABELS, winsCompletedBy, CardIndex } from '@/lib/cardShape';
import { ensureLocalCards, localCardIndex } from '@/lib/localCards';
import {
  DrawnNumber,
  adoptServerSession,
  drawNumber,
  drawRandom,
  getGame,
  resetNumbers,
  setPrizes as savePrizesLocally,
  setStatus,
  startGame,
  undoLast,
} from '@/lib/gameStore';
import {
  archiveCurrentGame,
  flushPendingGames,
  pendingCount,
  pendingNumbers,
  syncRunningGame,
} from '@/lib/gameSync';
import Drawer from '@/components/Drawer';
import Link from 'next/link';
import PrizeSettingsPanel, {
  DEFAULT_PRIZES,
  PRIZE_LABELS,
  PRIZE_ORDER,
  PrizeKey,
  PrizeSettings,
  normalizePrizes,
} from '@/components/PrizeSettings';

/**
 * The play screen.
 *
 * Every part of a game — drawing, undoing, pausing, the prize counters, who has
 * won — happens on this device, out of src/lib/gameStore and the cards cached
 * here. Not one of them touches the network. That is the whole point: the
 * caller never waits on a request, so the screen cannot fall behind the drum,
 * and a dead connection changes nothing about how the game plays.
 *
 * The server hears about the game when it is over.
 */

/** live counter for one prize: how many cards have taken it so far */
interface PrizeStatus {
  key: PrizeKey;
  label: string;
  enabled: boolean;
  count: number;
  won: number;
  closed: boolean;
}

interface Winner {
  setNo: number;
  cardNo: number;
  winType?: string;
  key?: PrizeKey;
  /** which place this card took in its prize (1 = first) */
  place?: number;
  count?: number;
  awarded?: Record<string, boolean>;
  paid?: boolean;
  row1?: boolean;
  row2?: boolean;
  row3?: boolean;
  corners?: boolean;
  fullCard?: boolean;
}

/** Winners and prize standings for a board, worked out here on the device. */
function readBoard(
  index: CardIndex,
  numbers: DrawnNumber[],
  prizes: PrizeSettings,
  justDrawn?: number
) {
  const orders = orderMap(numbers.map((n) => ({ number: n.number, draw_order: n.drawOrder })));
  const standings = computeStandings(index, orders, prizes);

  const fresh: Winner[] = [];
  if (justDrawn !== undefined) {
    const before = new Set(numbers.filter((n) => n.number !== justDrawn).map((n) => n.number));
    for (const cardIdx of index.byNumber.get(justDrawn) || []) {
      const card = index.cards[cardIdx];
      for (const key of winsCompletedBy(card, justDrawn, before)) {
        if (!prizes[key].enabled) continue;
        const standing = standings[key];
        const place = standing.winners.findIndex(
          (w) => w.setNo === card.setNo && w.cardNo === card.cardNo
        );
        if (place === -1) continue; // the prize was already full
        fresh.push({
          setNo: card.setNo,
          cardNo: card.cardNo,
          winType: WIN_LABELS[key],
          key,
          place: place + 1,
          count: standing.count,
        });
      }
    }
  }

  return { standings, fresh, status: toStatus(standings) };
}

export default function PlayPage() {
  const game = useGame();
  const [booting, setBooting] = useState(true);
  const [newSessionName, setNewSessionName] = useState('');
  const [error, setError] = useState('');

  const [manualNumber, setManualNumber] = useState('');

  // New Winner Alerts State
  const [activeNewWinners, setActiveNewWinners] = useState<Winner[]>([]);

  // All Winners Report State
  const [allWinners, setAllWinners] = useState<Winner[] | null>(null);

  /** the rules the start screen opens on, remembered from the club's last game */
  const [startPrizes, setStartPrizes] = useState<PrizeSettings>(DEFAULT_PRIZES);
  /** 'start' = confirm before the game begins, 'edit' = change them mid-game */
  const [prizeModal, setPrizeModal] = useState<null | 'start' | 'edit'>(null);
  /** the rules being edited in the modal, kept apart until they are confirmed */
  const [draftPrizes, setDraftPrizes] = useState<PrizeSettings>(DEFAULT_PRIZES);
  const [prizeNotice, setPrizeNotice] = useState('');
  /** the slide-over holding the session controls */
  const [menuOpen, setMenuOpen] = useState(false);
  /** reading balls off their stickers instead of typing them */
  const [scanOn, setScanOn] = useState(false);
  /** finished games still waiting to reach the server */
  const [queued, setQueued] = useState({ games: 0, numbers: 0 });
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState('');
  /** the cards are on this device, so winners can be named without a connection */
  const [cardsReady, setCardsReady] = useState(false);
  const online = useOnline();

  const prizes = game?.prizes ?? startPrizes;
  const refreshQueue = () => setQueued({ games: pendingCount(), numbers: pendingNumbers() });

  /* ------------------------------------------------------------------ */
  /* boot                                                                */
  /* ------------------------------------------------------------------ */

  /**
   * A game already on this device wins outright — no request is made, so a
   * reload in the middle of a game is instant and works with no connection.
   * Only when this device has no game do we ask the server whether the club has
   * one running somewhere else, and take it over.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      refreshQueue();

      if (!getGame()) {
        try {
          const res = await fetch('/api/sessions/current');
          const data = await res.json();
          if (!cancelled && data?.success) {
            if (data.session) {
              adoptServerSession({ ...data.session, numbers: data.session.numbers ?? [] });
            } else {
              setStartPrizes(normalizePrizes(data.lastPrizes));
            }
            if (data.prizesColumnMissing) {
              setPrizeNotice(
                'إعدادات الجوائز ما راح تنحفظ بالسيرفر: شغّل السكربت db/prizes.sql في Supabase مرة وحدة.'
              );
            }
          }
        } catch {
          // no connection and no game here: the start screen still works, and
          // the game that gets started will simply be uploaded later
        }
      }

      if (!cancelled) setBooting(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Keep a copy of the cards on this device. It is what lets the game name
   * winners with no connection, and costs one small download while there is one.
   */
  useEffect(() => {
    void ensureLocalCards().then((idx) => setCardsReady(Boolean(idx)));
  }, [online]);

  /**
   * Upload finished games — never while one is being played.
   *
   * The guard is the rule the caller asked for: no request leaves this device
   * while a game is live, so nothing can compete with the drum for attention.
   */
  const playing = game?.status === 'active';

  useEffect(() => {
    if (!online || playing) return;
    if (pendingCount() === 0) return;

    let cancelled = false;
    const run = async () => {
      const { left } = await flushPendingGames();
      if (!cancelled) refreshQueue();
      return left;
    };

    void run();
    const poll = setInterval(() => {
      if (pendingCount() > 0) void run();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [online, playing, queued.games]);

  /* ------------------------------------------------------------------ */
  /* the board                                                           */
  /* ------------------------------------------------------------------ */

  const numbers = useMemo(() => game?.numbers ?? [], [game]);

  /** The prize counters, recomputed here whenever the board moves. */
  const prizeStatus = useMemo(() => {
    const index = cardsReady ? localCardIndex() : null;
    if (!index || !game) return null;
    return readBoard(index, game.numbers, game.prizes).status;
  }, [game, cardsReady]);

  const announce = useCallback(
    (board: DrawnNumber[], justDrawn: number) => {
      const index = localCardIndex();
      if (!index || !game) return;
      const { fresh } = readBoard(index, board, game.prizes, justDrawn);
      if (fresh.length === 0) return;
      // added, not replaced: a fast run of numbers must not lose an alert
      setActiveNewWinners((prev) => [...prev, ...fresh].slice(-20));
    },
    [game]
  );

  /**
   * Put a number on the board.
   *
   * One synchronous call. Whether it came from the keypad, the grid, the random
   * button or a scanned sticker, it lands the same way and in the order it was
   * pressed — there is no request to arrive late and no state to be stale.
   */
  const submitNumber = useCallback(
    (num: number) => {
      const result = drawNumber(num);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setError('');
      announce(result.game.numbers, result.number);
    },
    [announce]
  );

  const handleDrawRandomNumber = useCallback(() => {
    const result = drawRandom();
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError('');
    announce(result.game.numbers, result.number);
  }, [announce]);

  const handleUndoLast = useCallback(() => {
    const removed = undoLast();
    if (removed === null) return;
    setError('');
    setActiveNewWinners([]);
    setAllWinners(null);
  }, []);

  /**
   * A scanned ball goes through exactly the same path as a tapped one.
   */
  const scan = useBallScanner({
    enabled: scanOn && game?.status === 'active',
    onScan: (ball) => submitNumber(ball),
  });

  const handleAddManualNumber = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(manualNumber, 10);
    if (isNaN(num) || num < 1 || num > 90) {
      setError('يرجى إدخال رقم صحيح بين 1 و 90');
      return;
    }
    setManualNumber(''); // cleared first so the next number can be typed at once
    submitNumber(num);
  };

  const handleNumberClick = (num: number) => submitNumber(num);

  /* ------------------------------------------------------------------ */
  /* the session                                                         */
  /* ------------------------------------------------------------------ */

  const handleStartSession = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDraftPrizes(startPrizes);
    setPrizeModal('start');
  };

  /** Starting a game is instant and local — it does not need the server at all. */
  const confirmStart = () => {
    startGame(newSessionName, draftPrizes);
    setStartPrizes(draftPrizes);
    setNewSessionName('');
    setAllWinners(null);
    setActiveNewWinners([]);
    setPrizeModal(null);
    setError('');
  };

  const savePrizes = () => {
    savePrizesLocally(draftPrizes);
    setStartPrizes(draftPrizes);
    setPrizeModal(null);
  };

  const openPrizeEditor = () => {
    setDraftPrizes(prizes);
    setPrizeModal('edit');
  };

  const handleToggleStatus = () => {
    if (!game) return;
    setStatus(game.status === 'active' ? 'paused' : 'active');
  };

  const handleResetSession = () => {
    if (!game) return;
    const confirmed = window.confirm(
      'تحذير هام: هل أنت متأكد من مسح جميع الأرقام المسحوبة الحالية وإعادة ضبط الجلسة للبدء من جديد؟'
    );
    if (!confirmed) return;
    resetNumbers();
    setAllWinners(null);
    setActiveNewWinners([]);
    setError('');
  };

  /**
   * End the game, then — and only then — send it.
   *
   * The game is put in the upload queue before the screen lets go of it, so the
   * caller can start the next game immediately whether or not the upload works.
   */
  const handleFinishSession = async () => {
    if (!game) return;
    const confirmed = window.confirm('هل تريد إنهاء هذه الجلسة وإغلاقها نهائياً؟');
    if (!confirmed) return;

    archiveCurrentGame();
    setAllWinners(null);
    setActiveNewWinners([]);
    refreshQueue();

    if (!navigator.onLine) {
      setSyncNote('الجلسة محفوظة بالجهاز — تنرفع لحالها أول ما يرجع النت.');
      return;
    }

    setSyncing(true);
    const { sent, left, error: failed } = await flushPendingGames();
    setSyncing(false);
    refreshQueue();
    setSyncNote(
      left === 0
        ? `تمت مزامنة ${sent === 1 ? 'الجلسة' : `${sent} جلسات`} مع السيرفر.`
        : failed || 'باقي جلسات ما انرفعت — راح تنعاد المحاولة.'
    );
  };

  /** The manual escape hatch: push the running game without ending it. */
  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncNote('');
    const flush = await flushPendingGames();
    let note = flush.sent > 0 ? `انرفعت ${flush.sent} جلسة. ` : '';

    if (game) {
      const result = await syncRunningGame();
      note += result.message;
    } else if (!note) {
      note = flush.left === 0 ? 'ماكو شي ينتظر الرفع.' : flush.error || 'تعذر الرفع.';
    }

    setSyncing(false);
    refreshQueue();
    setSyncNote(note);
  };

  const handleCheckAllWinners = () => {
    if (!game) return;
    const index = localCardIndex();
    if (!index) {
      alert('ما عندي نسخة السيتات بهذا الجهاز. افتح البرنامج مرة وحدة وهو متصل بالنت.');
      return;
    }

    const { standings } = readBoard(index, game.numbers, game.prizes);

    const paidBy = new Map<string, Record<string, boolean>>();
    for (const key of PRIZE_ORDER) {
      for (const w of standings[key].winners) {
        const id = `${w.setNo}:${w.cardNo}`;
        const row = paidBy.get(id) ?? {};
        row[key] = true;
        paidBy.set(id, row);
      }
    }

    const rows: Winner[] = [...paidBy.entries()].map(([id, awarded]) => {
      const [setNo, cardNo] = id.split(':').map(Number);
      return {
        setNo,
        cardNo,
        awarded,
        paid: true,
        row1: Boolean(awarded.row1),
        row2: Boolean(awarded.row2),
        row3: Boolean(awarded.row3),
        corners: Boolean(awarded.corners),
        fullCard: Boolean(awarded.fullCard),
      };
    });

    setAllWinners(rows);
  };

  /* ------------------------------------------------------------------ */

  const latestDraw = numbers.length > 0 ? numbers[numbers.length - 1].number : null;

  const prizeBoard: PrizeStatus[] = (
    prizeStatus ??
    PRIZE_ORDER.map((key) => ({
      key,
      label: PRIZE_LABELS[key],
      enabled: prizes[key].enabled,
      count: prizes[key].count,
      won: 0,
      closed: false,
    }))
  ).filter((p) => p.enabled);

  const formatSetNo = (no: number) => String(no).padStart(3, '0');
  const formatCardNo = (no: number) => String(no).padStart(2, '0');

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'club']}>
      <Navbar />
      <div className="w-full px-4 py-5 flex flex-col gap-5 select-none pb-24">

        {booting ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400 font-bold">
            <Loader2 className="animate-spin text-emerald-500" size={28} />
            <span className="text-xs" style={{ fontFamily: 'Cairo, sans-serif' }}>جاري تحميل بيانات اللعبة...</span>
          </div>
        ) : !game ? (
          /* NO ACTIVE SESSION */
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 text-center shadow-xl animate-[popIn_0.3s_ease-out] mt-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <Sparkles size={28} />
              </div>
              <h2 className="text-lg font-black text-slate-100" style={{ fontFamily: 'Cairo, sans-serif' }}>بدء جلسة سحب جديدة</h2>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                للبدء بسحب الأرقام ومراقبة الفائزين، يرجى تشغيل الجلسة أولاً.
                <br />
                بعد الضغط راح تطلعلك إعدادات الجوائز — عدّلها أو دوس موافق.
              </p>
            </div>

            {(queued.games > 0 || syncNote) && (
              <div className="mb-5 bg-sky-500/10 border border-sky-500/25 text-sky-400 p-3 rounded-xl text-[11px] font-bold leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {queued.games > 0
                  ? `كو ${queued.games} ${queued.games === 1 ? 'جلسة' : 'جلسات'} (${queued.numbers} رقم) محفوظة بالجهاز وتنتظر الرفع للسيرفر.`
                  : syncNote}
                {queued.games > 0 && (
                  <button
                    onClick={handleSyncNow}
                    disabled={syncing}
                    className="block mx-auto mt-2 py-1.5 px-4 rounded-lg border border-sky-500/40 hover:bg-sky-500/10 disabled:opacity-50 cursor-pointer"
                  >
                    {syncing ? 'جاري الرفع...' : 'ارفعها هسه'}
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs mb-5 font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleStartSession} className="flex flex-col gap-5 text-right">
              <div>
                <label htmlFor="session-name" className="block text-slate-300 font-bold text-xs mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  اسم الجلسة (اختياري)
                </label>
                <input
                  type="text"
                  id="session-name"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="مثال: سحب ديوان الجمعية"
                  className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 transition-colors text-sm"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-ink-fixed font-black py-3 px-6 rounded-xl text-sm transition-all active:scale-[0.98] flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                ابدأ جلسة السحب الآن 🎲
              </button>
            </form>
          </div>
        ) : (
          /* PLAY SESSION RUNNING */
          <div className="flex flex-col gap-4">

            {/* A slim bar: the game keeps the screen, the rest lives behind it */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2.5 flex items-center justify-between gap-3">
              <button
                onClick={() => setMenuOpen(true)}
                className="flex items-center gap-1.5 py-1.5 px-2.5 text-[11px] font-bold text-slate-300 border border-slate-700 hover:bg-slate-800 rounded-lg transition-all cursor-pointer flex-shrink-0"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <SlidersHorizontal size={13} />
                <span>الإعدادات</span>
              </button>

              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setScanOn((v) => !v)}
                  aria-pressed={scanOn}
                  title="قراءة الطوبة بالماسح"
                  className={`flex items-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer flex-shrink-0 ${
                    scanOn
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  <ScanLine size={12} />
                  <span>الماسح</span>
                </button>
                <h2
                  className="text-[11px] font-bold text-slate-300 truncate hidden sm:block"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {game.name}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold text-[9px] flex-shrink-0 ${
                    game.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  {game.status === 'active' ? 'نشط' : 'متوقف'}
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/25 text-red-400 p-3 rounded-xl text-xs font-bold text-center">
                {error}
              </div>
            )}

            {prizeNotice && (
              <div className="bg-amber-500/10 border border-amber-500/25 text-amber-400 p-3 rounded-xl text-[11px] font-bold text-center leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {prizeNotice}
              </div>
            )}

            {/* The connection is worth a line only because it explains the
                winner check — the game itself does not care either way. */}
            {(!online || !cardsReady) && (
              <div
                className={`rounded-xl border p-3 flex items-start gap-2.5 text-[11px] font-bold leading-relaxed ${
                  cardsReady
                    ? 'bg-slate-900 border-slate-800 text-slate-400'
                    : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                }`}
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {online ? (
                  <CloudUpload size={15} className="flex-shrink-0 mt-0.5" />
                ) : (
                  <WifiOff size={15} className="flex-shrink-0 mt-0.5" />
                )}
                <span className="flex-1">
                  {cardsReady
                    ? 'ماكو نت — اللعبة شغالة كاملة بالجهاز، والمزامنة تصير بعد ما تخلص الجلسة.'
                    : 'ما وصلت نسخة السيتات لهذا الجهاز بعد، فما أكدر أطلّع الفائزين. افتح البرنامج مرة وحدة وهو متصل بالنت.'}
                </span>
              </div>
            )}

            {scanOn && (
              <div
                className={`rounded-xl border p-3 flex items-center gap-2.5 text-xs font-bold ${
                  scan.rejected
                    ? 'bg-red-500/10 border-red-500/25 text-red-400'
                    : scan.ball
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <ScanLine size={16} className="flex-shrink-0" />
                <span className="flex-1">
                  {scan.rejected
                    ? `ما عرفت هذا الباركود: ${scan.rejected}`
                    : scan.ball
                    ? `انقرأت الطوبة ${scan.ball}`
                    : 'الماسح جاهز — دك الطوبة وهي تنزل لحالها.'}
                </span>
                {game.status !== 'active' && (
                  <span className="text-amber-400 text-[10px] flex-shrink-0">الجلسة متوقفة</span>
                )}
              </div>
            )}

            {/* Typing a number is the fastest way in, so it comes first */}
            <form onSubmit={handleAddManualNumber} className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="90"
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                placeholder="اكتب الرقم (1 - 90)"
                className="w-full px-4 py-3 text-base font-black text-center rounded-xl border border-slate-800 bg-slate-950 text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                disabled={game.status !== 'active'}
                required
                style={{ fontFamily: 'Cairo, sans-serif' }}
              />
              <button
                type="submit"
                className="px-6 py-3 text-sm font-black bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-ink-fixed rounded-xl transition-all active:scale-95 cursor-pointer flex-shrink-0"
                disabled={game.status !== 'active'}
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                إضافة
              </button>
            </form>

            {/* The drum: balls live here, and a drawn one flies out into the sphere */}
            <DrawDrum
              drawn={numbers}
              latest={latestDraw}
              active={game.status === 'active'}
              onPick={handleNumberClick}
              onRandom={handleDrawRandomNumber}
              onUndo={handleUndoLast}
            />

          </div>
        )}

        {/* ---------------- SLIDE-OVER: everything that is not the board ---------------- */}
        {game && (
        <Drawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          title="إعدادات الجلسة"
          subtitle={game.name}
        >
            {/* Live prize board — what is still open and what has gone */}
          {prizeBoard.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <Gift size={14} className="text-amber-400" /> الجوائز:
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {prizeBoard.map((p) => (
                  <div
                    key={p.key}
                    className={`px-2.5 py-2 rounded-xl border flex items-center justify-between gap-2 ${
                      p.closed
                        ? 'bg-slate-950/60 border-slate-850 text-slate-500'
                        : p.won > 0
                        ? 'bg-emerald-500/5 border-emerald-500/25 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] font-black truncate" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {p.label}
                    </span>
                    <span className="text-[10px] font-mono font-black flex-shrink-0" style={{ direction: 'ltr' }}>
                      {`${p.won}/${p.count}`}
                    </span>
                  </div>
                ))}
              </div>

              {prizeBoard.some((p) => p.closed) && (
                <p className="mt-2.5 text-[9px] text-slate-500 text-center" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  الجائزة الرمادية مكتملة — ما عاد تنبّه على فائز جديد.
                </p>
              )}
            </div>
          )}

          {/* Where the game stands with the server. Never in the way of play. */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-[11px] font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
              {online ? (
                <CloudUpload size={14} className="text-sky-400 flex-shrink-0" />
              ) : (
                <CloudOff size={14} className="text-amber-400 flex-shrink-0" />
              )}
              <span className="text-slate-300">
                {game.serverId === null
                  ? 'هاي الجلسة لسه ما انرفعت — تنرفع من تخلصها.'
                  : `آخر رفع: ${game.syncedCount} من ${numbers.length} رقم.`}
              </span>
            </div>

            {queued.games > 0 && (
              <p className="text-[10px] text-slate-500" style={{ fontFamily: 'Cairo, sans-serif' }}>
                وكو {queued.games} {queued.games === 1 ? 'جلسة سابقة' : 'جلسات سابقة'} بانتظار الرفع.
              </p>
            )}

            {syncNote && (
              <p className="text-[10px] text-sky-400 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {syncNote}
              </p>
            )}

            <button
              onClick={handleSyncNow}
              disabled={syncing || !online}
              className="flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-extrabold border border-sky-500/25 hover:border-sky-500/45 text-sky-400 bg-sky-500/5 disabled:opacity-40 rounded-xl transition-all cursor-pointer"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <CloudUpload size={13} />
              {syncing ? 'جاري الرفع...' : online ? 'مزامنة الآن (اختياري)' : 'ماكو نت'}
            </button>
          </div>

              <div className="grid grid-cols-2 gap-2">
            <Link
              href="/labels"
              onClick={() => setMenuOpen(false)}
              className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-extrabold border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <QrCode size={13} /> طبع باركود الطوبات
            </Link>

            <button
              onClick={() => {
                setMenuOpen(false);
                openPrizeEditor();
              }}
              className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-extrabold border border-amber-500/25 hover:border-amber-500/45 text-amber-400 bg-amber-500/5 rounded-xl transition-all cursor-pointer"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <Gift size={13} /> إعدادات الجوائز
            </button>

            <button
              onClick={() => {
                setMenuOpen(false);
                handleCheckAllWinners();
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-extrabold border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-400 bg-cyan-500/5 rounded-xl transition-all cursor-pointer"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <Award size={13} /> فحص الفائزين
            </button>

            <button
              onClick={handleToggleStatus}
              className="flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-bold border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {game.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
              <span>{game.status === 'active' ? 'إيقاف مؤقت' : 'استئناف'}</span>
            </button>

            <button
              onClick={() => {
                setMenuOpen(false);
                handleResetSession();
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-bold border border-red-500/20 hover:border-red-500/30 text-red-400 bg-red-500/5 rounded-xl transition-all cursor-pointer"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <RotateCcw size={13} /> إعادة تصفير الجولة
            </button>

            <button
              onClick={() => {
                setMenuOpen(false);
                void handleFinishSession();
              }}
              className="py-2 px-3 text-[11px] font-bold bg-red-500/20 border border-red-500/30 hover:bg-red-500 hover:text-white text-red-400 rounded-xl transition-all cursor-pointer"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              إنهاء وإغلاق الجلسة
            </button>
          </div>
        </Drawer>
        )}

        {/* -------------------- 0. POPUP MODAL: PRIZE RULES -------------------- */}
        {prizeModal !== null && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[92vh] flex flex-col">

              <div className="p-5 pb-3 border-b border-slate-800 flex items-start justify-between gap-3">
                <div className="text-right">
                  <h3 className="text-sm font-black text-slate-100 flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    <Gift className="text-amber-400" size={16} />
                    {prizeModal === 'start' ? 'جوائز هذه الجلسة' : 'تعديل الجوائز'}
                  </h3>
                  <p className="text-slate-400 text-[10px] mt-1 leading-relaxed" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    {prizeModal === 'start'
                      ? 'شغّل أو أطفي أي خط، وحدد كم مرة يفوز — أو دوس موافق وابدأ.'
                      : 'التعديل ينطبق حالاً على نفس الجلسة.'}
                  </p>
                </div>

                <button
                  onClick={() => setPrizeModal(null)}
                  className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  aria-label="إغلاق"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                <PrizeSettingsPanel
                  value={draftPrizes}
                  onChange={setDraftPrizes}
                  status={prizeModal === 'edit' ? prizeStatus : null}
                />
              </div>

              {error && (
                <div className="mx-4 mb-2 bg-red-500/10 border border-red-500/25 text-red-400 p-2.5 rounded-xl text-[11px] font-bold text-center" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  {error}
                </div>
              )}

              <div className="p-4 pt-2 border-t border-slate-800 flex gap-2">
                <button
                  onClick={() => setPrizeModal(null)}
                  className="px-4 py-3 text-xs font-bold border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  رجوع
                </button>

                <button
                  onClick={prizeModal === 'start' ? confirmStart : savePrizes}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-ink-fixed font-black py-3 px-6 rounded-xl text-sm transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/10 cursor-pointer"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  <Check size={16} />
                  {prizeModal === 'start' ? 'موافق وابدأ الجلسة' : 'حفظ التعديلات'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* -------------------- 1. POPUP MODAL: NEW WINNER ALERT -------------------- */}
        {activeNewWinners.length > 0 && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl shadow-2xl max-w-sm w-full p-5 text-center relative animate-[popIn_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">

              <button
                onClick={() => setActiveNewWinners([])}
                className="absolute top-4 left-4 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-500/20 animate-bounce">
                <Award size={28} />
              </div>

              <h2 className="text-lg font-black text-emerald-400 mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                🏆 يوجد فائز جديد! 🏆
              </h2>
              <p className="text-slate-400 text-[10px] mb-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
                تم اكتمال خطوط اللعب للبطاقات التالية بفعل الرقم الأخير:
              </p>

              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto mb-5 text-right">
                {activeNewWinners.map((winner, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex justify-between items-center"
                  >
                    <span className="font-bold text-slate-200 text-xs flex flex-col items-start gap-0.5">
                      <span>السيت: {formatSetNo(winner.setNo)} | كرت: {formatCardNo(winner.cardNo)}</span>
                      {winner.place !== undefined && winner.count ? (
                        <span className="text-[9px] font-black text-slate-500" style={{ fontFamily: 'Cairo, sans-serif' }}>
                          الفائز {winner.place} من {winner.count}
                        </span>
                      ) : null}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg font-black text-[10px] flex-shrink-0 ${
                      winner.winType === 'البطاقة كاملة (دمبلة)'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : winner.winType === 'الزوايا'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {winner.winType}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setActiveNewWinners([])}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-ink-fixed font-black py-2.5 px-6 rounded-xl text-xs transition-all cursor-pointer"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                متابعة اللعب 🎲
              </button>
            </div>
          </div>
        )}

        {/* -------------------- 2. POPUP MODAL: ALL WINNERS REPORT -------------------- */}
        {allWinners !== null && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-sm w-full p-5 max-h-[80vh] overflow-y-auto relative">

              <button
                onClick={() => setAllWinners(null)}
                className="absolute top-4 left-4 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <h3 className="text-sm font-black text-slate-100 mb-1 flex items-center gap-1.5" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <Award className="text-emerald-400" size={16} /> تقرير الفائزين الإجمالي بالجلسة
              </h3>
              <p className="text-slate-400 text-[10px] mb-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
                قائمة بجميع البطاقات الفائزة مقارنة بكامل الأرقام المسحوبة بالجلسة.
              </p>

              {prizeBoard.length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-1.5">
                  {prizeBoard.map((p) => (
                    <div
                      key={p.key}
                      className={`px-2 py-1.5 rounded-lg border text-[9px] font-black flex items-center justify-between gap-1 ${
                        p.closed
                          ? 'bg-slate-950/60 border-slate-850 text-slate-500'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="truncate" style={{ fontFamily: 'Cairo, sans-serif' }}>{p.label}</span>
                      <span className="font-mono flex-shrink-0" style={{ direction: 'ltr' }}>
                        {`${p.won}/${p.count}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {allWinners.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  <p style={{ fontFamily: 'Cairo, sans-serif' }}>لا يوجد أي بطاقة فائزة في الجلسة حتى الآن.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {allWinners.map((winner, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-2 text-right text-xs"
                    >
                      <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                        <span className="font-extrabold text-slate-200">
                          سيت {formatSetNo(winner.setNo)} | كرت {formatCardNo(winner.cardNo)}
                        </span>
                        <div className="flex gap-1">
                          {winner.awarded?.corners && (
                            <span className="px-2 py-0.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-lg text-[9px] font-black" style={{ fontFamily: 'Cairo, sans-serif' }}>
                              ◤ الزوايا
                            </span>
                          )}
                          {winner.fullCard && (
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border ${
                              winner.awarded?.fullCard
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                : 'bg-slate-900 border-slate-800 text-slate-500'
                            }`} style={{ fontFamily: 'Cairo, sans-serif' }}>
                              🏆 دمبلة
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Green = took the prize. Amber = line complete but the
                          prize was already full or switched off. */}
                      <div className="grid grid-cols-4 gap-1 text-[10px] font-bold text-center">
                        {([
                          ['row1', 'السطر 1', winner.row1],
                          ['row2', 'السطر 2', winner.row2],
                          ['row3', 'السطر 3', winner.row3],
                          ['corners', 'الزوايا', winner.corners],
                        ] as [PrizeKey, string, boolean | undefined][]).map(([key, label, done]) => {
                          const paid = Boolean(winner.awarded?.[key]);
                          return (
                            <div
                              key={key}
                              className={`p-1 rounded ${
                                paid
                                  ? key === 'corners'
                                    ? 'bg-sky-500/10 text-sky-400'
                                    : 'bg-emerald-500/10 text-emerald-400'
                                  : done
                                  ? 'bg-amber-500/5 text-amber-500/70'
                                  : 'bg-slate-900 text-slate-600'
                              }`}
                              style={{ fontFamily: 'Cairo, sans-serif' }}
                            >
                              {label}: {paid ? 'فائز' : done ? 'متأخر' : '✖'}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5">
                <button
                  onClick={() => setAllWinners(null)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-ink-fixed font-black py-2 rounded-xl text-xs cursor-pointer"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                >
                  إغلاق التقرير
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </ProtectedRoute>
  );
}
