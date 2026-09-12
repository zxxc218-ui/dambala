import { NextRequest, NextResponse } from 'next/server';
import { isSignedIn } from '@/lib/auth';
import { getCardIndex } from '@/lib/cards';

/**
 * The whole card index, small enough for a phone to keep.
 *
 * The play screen downloads this once and stores it, so that when the hall's
 * connection dies it can still say who won — running the very same rules the
 * server runs, out of src/lib/cardShape.
 *
 * The shape is deliberately terse: one array per card of
 * [setNo, cardNo, ...row1, -1, ...row2, -1, ...row3]. Rows vary in length, so
 * -1 separates them. Around 60KB for all 900 cards.
 */
export async function GET(req: NextRequest) {
  if (!isSignedIn(req)) {
    return NextResponse.json(
      { success: false, message: 'يرجى تسجيل الدخول أولاً', needsLogin: true },
      { status: 401 }
    );
  }

  try {
    const index = await getCardIndex();

    const cards = index.cards.map((c) => [
      c.setNo,
      c.cardNo,
      ...c.rows[0],
      -1,
      ...c.rows[1],
      -1,
      ...c.rows[2],
    ]);

    return NextResponse.json(
      { success: true, version: index.builtAt, cards },
      {
        // the sets change only when the owner edits them, so let the browser
        // keep it while still revalidating
        headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'تعذر تجهيز نسخة السيتات: ' + error.message },
      { status: 500 }
    );
  }
}
