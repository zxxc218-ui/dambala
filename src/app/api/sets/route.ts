import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';
import { validateTambolaData } from '@/lib/validation';

// GET: Fetch all sets with validation status
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

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({
          success: false,
          isSchemaMissing: true,
          message: 'جداول قاعدة البيانات غير موجودة في Supabase. يرجى فتح SQL Editor في Supabase وتشغيل السكربت لإنشاء الجداول.'
        });
      }
      throw error;
    }

    const sets = (dbSets || []).map(setRecord => {
      const rawRowsForValidation: any[] = [];
      const cards = setRecord.cards || [];

      cards.forEach((c: any) => {
        const rows = c.card_rows || [];
        rows.forEach((r: any) => {
          rawRowsForValidation.push({
            set_no: setRecord.set_no,
            card_no: c.card_no,
            row_no: r.row_no,
            c1: r.c1,
            c2: r.c2,
            c3: r.c3,
            c4: r.c4,
            c5: r.c5,
            c6: r.c6,
            c7: r.c7,
            c8: r.c8,
            c9: r.c9,
          });
        });
      });

      const report = validateTambolaData(rawRowsForValidation);

      return {
        id: setRecord.id,
        setNo: setRecord.set_no,
        createdAt: setRecord.created_at,
        isValid: report.isValid,
        errorsCount: report.errors.length
      };
    });

    return NextResponse.json({ success: true, sets });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء جلب السيتات من Supabase: ' + error.message },
      { status: 500 }
    );
  }
}

// POST: Bulk import validated sets (Admin Only)
export async function POST(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json(
        { success: false, message: 'غير مصرح لك بالقيام بهذا الإجراء' },
        { status: 403 }
      );
    }

    const { sets } = await req.json();

    if (!sets || !Array.isArray(sets) || sets.length === 0) {
      return NextResponse.json(
        { success: false, message: 'البيانات المرسلة غير صالحة أو فارغة' },
        { status: 400 }
      );
    }

    // 1. Delete all existing sets (Cascade deletes cards and card_rows in DB)
    const { error: deleteErr } = await supabase
      .from('sets')
      .delete()
      .neq('set_no', 0); // Deletes all sets

    if (deleteErr) throw deleteErr;

    // 2. Bulk insert Sets
    const setsToInsert = sets.map(s => ({ set_no: s.setNo }));
    const { data: insertedSets, error: setsErr } = await supabase
      .from('sets')
      .insert(setsToInsert)
      .select();

    if (setsErr || !insertedSets) throw setsErr || new Error('فشل إدراج السيتات');

    // Create a mapping of setNo -> setId
    const setUuidMap = new Map<number, string>();
    insertedSets.forEach(s => setUuidMap.set(s.set_no, s.id));

    // 3. Bulk insert Cards
    const cardsToInsert: any[] = [];
    sets.forEach(set => {
      const setId = setUuidMap.get(set.setNo);
      if (!setId) return;

      set.cards.forEach((card: any) => {
        cardsToInsert.push({
          set_id: setId,
          card_no: card.cardNo,
          // Store temp card key to match inserted cards back
          created_at: new Date().toISOString() // dummy field or just we can match by set_id and card_no later
        });
      });
    });

    const { data: insertedCards, error: cardsErr } = await supabase
      .from('cards')
      .insert(cardsToInsert)
      .select();

    if (cardsErr || !insertedCards) throw cardsErr || new Error('فشل إدراج البطاقات');

    // Create a mapping of (setId + '_' + cardNo) -> cardId
    const cardUuidMap = new Map<string, string>();
    insertedCards.forEach(c => cardUuidMap.set(`${c.set_id}_${c.card_no}`, c.id));

    // 4. Bulk insert Card Rows
    const rowsToInsert: any[] = [];
    sets.forEach(set => {
      const setId = setUuidMap.get(set.setNo);
      if (!setId) return;

      set.cards.forEach((card: any) => {
        const cardId = cardUuidMap.get(`${setId}_${card.cardNo}`);
        if (!cardId) return;

        card.rows.forEach((row: any) => {
          rowsToInsert.push({
            card_id: cardId,
            row_no: row.rowNo,
            c1: row.c1,
            c2: row.c2,
            c3: row.c3,
            c4: row.c4,
            c5: row.c5,
            c6: row.c6,
            c7: row.c7,
            c8: row.c8,
            c9: row.c9
          });
        });
      });
    });

    // Chunk rows insertion if size is huge (2700 rows is fine in single insert, but let's chunk in 1000s to be safe)
    const chunkSize = 800;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      const { error: rowsErr } = await supabase
        .from('card_rows')
        .insert(chunk);

      if (rowsErr) throw rowsErr;
    }

    return NextResponse.json({
      success: true,
      message: `تم استيراد ${sets.length} سيت بنجاح (إجمالي ${sets.length * 6} بطاقة)`
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء استيراد البيانات إلى Supabase: ' + error.message },
      { status: 500 }
    );
  }
}

// DELETE: Clear all sets (Admin Only)
export async function DELETE(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json(
        { success: false, message: 'غير مصرح لك بالقيام بهذا الإجراء' },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('sets')
      .delete()
      .neq('set_no', 0);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'تم حذف جميع السيتات والبطاقات من Supabase بنجاح'
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء حذف السيتات: ' + error.message },
      { status: 500 }
    );
  }
}
