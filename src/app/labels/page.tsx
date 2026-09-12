'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Printer, QrCode, Info } from 'lucide-react';
import { QR_SIZE, ballMatrix, ballPayload } from '@/lib/ballCodes';

/**
 * The sticker sheet for the real balls.
 *
 * Everything here is sized in millimetres, because the output is a physical
 * sticker that has to fit on a ball — a sheet that looks right on screen and
 * prints at the wrong size is useless. The browser's print scaling must be
 * left at 100% for that to hold, which the page says on it.
 *
 * The code carries error-correction level H, so roughly a third of a sticker
 * can be scuffed or curve away from the scanner and it still reads.
 */

/** white margin around the code, in modules — the scanner needs it to find the code */
const QUIET = 2;
/** the code's share of the label's diameter; the rest is the printed number */
const QR_SHARE = 0.68;

const SIZES = [12, 14, 16, 18];

function Label({ n, mm }: { n: number; mm: number }) {
  const matrix = ballMatrix(n);
  if (!matrix) return null;

  const side = QR_SIZE + QUIET * 2;
  const qrMM = mm * QR_SHARE;
  const cell = qrMM / side;

  return (
    <div
      className="label"
      style={{ width: `${mm}mm`, height: `${mm}mm` }}
      title={ballPayload(n)}
    >
      <svg
        width={`${qrMM}mm`}
        height={`${qrMM}mm`}
        viewBox={`0 0 ${side} ${side}`}
        shapeRendering="crispEdges"
      >
        <rect width={side} height={side} fill="#fff" />
        {matrix.map((row, y) =>
          row.map((on, x) =>
            on ? (
              <rect key={`${x}-${y}`} x={x + QUIET} y={y + QUIET} width={1} height={1} fill="#000" />
            ) : null
          )
        )}
      </svg>
      <span className="label-no" style={{ fontSize: `${mm * 0.2}mm`, lineHeight: 1 }}>
        {n}
      </span>
      <span className="sr-only">{cell.toFixed(3)}</span>
    </div>
  );
}

export default function LabelsPage() {
  const [mm, setMm] = useState(14);
  const [copies, setCopies] = useState(1);

  const balls: number[] = [];
  for (let c = 0; c < copies; c++) for (let n = 1; n <= 90; n++) balls.push(n);

  const moduleMM = (mm * QR_SHARE) / (QR_SIZE + QUIET * 2);

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'club']}>
      <div className="no-print">
        <Navbar />
      </div>

      <style jsx global>{`
        .sheet-labels {
          display: flex;
          flex-wrap: wrap;
          gap: 2mm;
          background: #fff;
          padding: 3mm;
          border-radius: 12px;
        }
        .label {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.3mm;
          background: #fff;
          color: #000;
          border-radius: 50%;
          /* a hairline so the sticker can be cut out by hand */
          outline: 0.12mm dashed #9aa4b2;
          outline-offset: -0.12mm;
          overflow: hidden;
        }
        .label-no {
          font-family: ui-monospace, 'Courier New', monospace;
          font-weight: 700;
          color: #000;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip-path: inset(50%);
        }
        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }
          .no-print {
            display: none !important;
          }
          body,
          .app-shell {
            background: #fff !important;
            border: 0 !important;
            box-shadow: none !important;
            max-width: none !important;
            padding: 0 !important;
          }
          .sheet-labels {
            padding: 0;
            gap: 1.6mm;
          }
          .label {
            break-inside: avoid;
            outline-color: #c9ced6;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="w-full px-4 py-5 flex flex-col gap-4 pb-24 md:pb-10">
        <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h1
              className="text-sm font-black text-slate-100 flex items-center gap-2"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <QrCode className="text-emerald-400" size={18} /> باركود الطوبات
            </h1>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-ink-fixed font-black text-xs py-2 px-4 rounded-xl transition-all active:scale-95 cursor-pointer"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <Printer size={14} /> طباعة
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <span
              className="text-[10px] font-bold text-slate-400"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              قياس اللاصق (قطر الطوبة عادة 18 - 21 مم)
            </span>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setMm(s)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black border transition-colors cursor-pointer ${
                    mm === s
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {s} مم
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span
              className="text-[10px] font-bold text-slate-400"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              عدد النسخ من كل رقم
            </span>
            <div className="flex gap-2">
              {[1, 2, 3].map((c) => (
                <button
                  key={c}
                  onClick={() => setCopies(c)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black border transition-colors cursor-pointer ${
                    copies === c
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex gap-2.5">
            <Info size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <div
              className="text-[10px] text-slate-400 leading-relaxed"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              عند الطباعة خلّي <strong className="text-slate-200">الحجم 100%</strong> (مو «ملاءمة
              الصفحة»)، وإلا يطلع القياس غلط. حجم المربع الواحد بالكود الآن{' '}
              <strong className="text-slate-200 font-mono">{moduleMM.toFixed(2)} مم</strong> — كل ما
              زاد صار القراءة أسهل.
              <br />
              الكود مستوى تصحيح H: لو انخربش ثلث اللاصق لسّه ينقرأ. والرقم مطبوع تحته حتى تعرفه
              بعينك.
            </div>
          </div>

          <p
            className="text-[10px] text-slate-500 text-center"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {balls.length} لاصق · {copies > 1 ? `${copies} نسخ من كل رقم` : 'نسخة واحدة من كل رقم'}
          </p>
        </div>

        <div className="sheet-labels">
          {balls.map((n, i) => (
            <Label key={`${n}-${i}`} n={n} mm={mm} />
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
