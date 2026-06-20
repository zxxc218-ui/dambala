import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { data: dbSets, error } = await supabase
      .from('sets')
      .select(`
        id,
        set_no,
        created_at,
        cards (
          id,
          card_no,
          card_rows (
            row_no,
            c1, c2, c3, c4, c5, c6, c7, c8, c9
          )
        )
      `)
      .order('set_no', { ascending: true });

    if (error) throw error;

    // Format sets to be consistent with client printing page expectation
    const sets = (dbSets || []).map((setRecord: any) => {
      const cards = (setRecord.cards || []).map((c: any) => {
        const rows = (c.card_rows || []).map((r: any) => ({
          rowNo: r.row_no,
          c1: r.c1, c2: r.c2, c3: r.c3, c4: r.c4, c5: r.c5, c6: r.c6, c7: r.c7, c8: r.c8, c9: r.c9
        }));
        rows.sort((a: any, b: any) => a.rowNo - b.rowNo);

        return {
          id: c.id,
          cardNo: c.card_no,
          rows
        };
      });
      cards.sort((a: any, b: any) => a.cardNo - b.cardNo);

      return {
        id: setRecord.id,
        setNo: setRecord.set_no,
        createdAt: setRecord.created_at,
        cards
      };
    });

    return NextResponse.json({ success: true, sets });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء جلب السيتات للطباعة من Supabase: ' + error.message },
      { status: 500 }
    );
  }
}
