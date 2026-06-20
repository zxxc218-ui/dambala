import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';
import { validateTambolaData } from '@/lib/validation';

function validateCardLayout(rows: any[], cardNo: number) {
  const errors: string[] = [];
  
  if (!rows || rows.length !== 3) {
    errors.push(`البطاقة ${cardNo}: يجب أن تحتوي على 3 أسطر بالتمام`);
    return errors;
  }

  let cardNumbersCount = 0;

  for (const row of rows) {
    const rowNo = parseInt(row.rowNo, 10);
    if (isNaN(rowNo) || rowNo < 1 || rowNo > 3) {
      errors.push(`البطاقة ${cardNo}: رقم السطر غير صالح: ${row.rowNo}`);
      continue;
    }

    const cols = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'];
    let rowNumbersCount = 0;

    cols.forEach((col, idx) => {
      const rawVal = row[col];
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        const val = parseInt(rawVal, 10);
        if (isNaN(val)) {
          errors.push(`البطاقة ${cardNo} - السطر ${rowNo}: القيمة في العمود ${col.toUpperCase()} ليست رقماً صالحاً`);
          return;
        }

        rowNumbersCount++;
        cardNumbersCount++;

        if (val < 1 || val > 90) {
          errors.push(`البطاقة ${cardNo} - السطر ${rowNo}: الرقم ${val} خارج النطاق المسموح به (1-90)`);
        }

        const colMin = idx === 0 ? 1 : idx * 10;
        const colMax = idx === 8 ? 90 : (idx * 10) + 9;
        if (val < colMin || val > colMax) {
          errors.push(`البطاقة ${cardNo} - السطر ${rowNo}: الرقم ${val} موضوع في العمود ${col.toUpperCase()} بشكل خاطئ (يجب أن يكون بين ${colMin} و ${colMax})`);
        }
      }
    });

    if (rowNumbersCount !== 5) {
      errors.push(`البطاقة ${cardNo} - السطر ${rowNo} يحتوي على ${rowNumbersCount} أرقام بدلاً من 5 أرقام`);
    }
  }

  if (cardNumbersCount !== 15 && errors.length === 0) {
    errors.push(`البطاقة ${cardNo} تحتوي على ${cardNumbersCount} أرقام بدلاً من 15 رقم`);
  }

  return errors;
}

// GET: Fetch single set details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ setNo: string }> }
) {
  try {
    const { setNo } = await params;
    const parsedSetNo = parseInt(setNo, 10);

    if (isNaN(parsedSetNo)) {
      return NextResponse.json(
        { success: false, message: 'رقم السيت غير صالح' },
        { status: 400 }
      );
    }

    const { data: setRecord, error } = await supabase
      .from('sets')
      .select(`
        id,
        set_no,
        cards (
          id,
          card_no,
          card_rows (
            row_no,
            c1, c2, c3, c4, c5, c6, c7, c8, c9
          )
        )
      `)
      .eq('set_no', parsedSetNo)
      .maybeSingle();

    if (error) throw error;

    if (!setRecord) {
      return NextResponse.json(
        { success: false, message: `السيت رقم ${setNo} غير موجود` },
        { status: 404 }
      );
    }

    // Format response consistent with SQLite output
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

    const formattedSet = {
      id: setRecord.id,
      setNo: setRecord.set_no,
      cards
    };

    return NextResponse.json({ success: true, set: formattedSet });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء جلب تفاصيل السيت: ' + error.message },
      { status: 500 }
    );
  }
}

// PUT: Save full set (6 cards) (Admin Only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ setNo: string }> }
) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json(
        { success: false, message: 'غير مصرح لك بالقيام بهذا الإجراء' },
        { status: 403 }
      );
    }

    const { setNo } = await params;
    const parsedSetNo = parseInt(setNo, 10);

    if (isNaN(parsedSetNo)) {
      return NextResponse.json(
        { success: false, message: 'رقم السيت غير صالح' },
        { status: 400 }
      );
    }

    const { cards } = await req.json();

    if (!cards || !Array.isArray(cards) || cards.length !== 6) {
      return NextResponse.json(
        { success: false, message: 'يجب توفير 6 بطاقات تماماً لحفظ السيت كامل' },
        { status: 400 }
      );
    }

    // 1. Validate layout for all 6 cards
    const allLayoutErrors: string[] = [];
    cards.forEach((card) => {
      const cardNo = parseInt(card.cardNo, 10);
      const layoutErrors = validateCardLayout(card.rows, isNaN(cardNo) ? 0 : cardNo);
      allLayoutErrors.push(...layoutErrors);
    });

    if (allLayoutErrors.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'فشل حفظ السيت لوجود أخطاء في التوزيع الهيكلي للبطاقات',
          errors: allLayoutErrors 
        },
        { status: 400 }
      );
    }

    // 2. Upsert Set record
    let setId: string;
    const { data: existingSet } = await supabase
      .from('sets')
      .select('id')
      .eq('set_no', parsedSetNo)
      .maybeSingle();

    if (existingSet) {
      setId = existingSet.id;
    } else {
      const { data: newSet, error: setErr } = await supabase
        .from('sets')
        .insert({ set_no: parsedSetNo })
        .select('id')
        .single();
      
      if (setErr || !newSet) throw setErr || new Error('فشل إنشاء السيت');
      setId = newSet.id;
    }

    // 3. Upsert Cards and rows
    for (const cardData of cards) {
      const cardNo = parseInt(cardData.cardNo, 10);

      // Upsert Card
      let cardId: string;
      const { data: existingCard } = await supabase
        .from('cards')
        .select('id')
        .eq('set_id', setId)
        .eq('card_no', cardNo)
        .maybeSingle();

      if (existingCard) {
        cardId = existingCard.id;
      } else {
        const { data: newCard, error: cardErr } = await supabase
          .from('cards')
          .insert({ set_id: setId, card_no: cardNo })
          .select('id')
          .single();

        if (cardErr || !newCard) throw cardErr || new Error('فشل إنشاء الكرت');
        cardId = newCard.id;
      }

      // Upsert Rows in bulk
      const rowsToUpsert = cardData.rows.map((rowUpdate: any) => {
        const rowNo = parseInt(rowUpdate.rowNo, 10);
        return {
          card_id: cardId,
          row_no: rowNo,
          c1: rowUpdate.c1 === '' || rowUpdate.c1 === undefined || rowUpdate.c1 === null ? null : parseInt(rowUpdate.c1, 10),
          c2: rowUpdate.c2 === '' || rowUpdate.c2 === undefined || rowUpdate.c2 === null ? null : parseInt(rowUpdate.c2, 10),
          c3: rowUpdate.c3 === '' || rowUpdate.c3 === undefined || rowUpdate.c3 === null ? null : parseInt(rowUpdate.c3, 10),
          c4: rowUpdate.c4 === '' || rowUpdate.c4 === undefined || rowUpdate.c4 === null ? null : parseInt(rowUpdate.c4, 10),
          c5: rowUpdate.c5 === '' || rowUpdate.c5 === undefined || rowUpdate.c5 === null ? null : parseInt(rowUpdate.c5, 10),
          c6: rowUpdate.c6 === '' || rowUpdate.c6 === undefined || rowUpdate.c6 === null ? null : parseInt(rowUpdate.c6, 10),
          c7: rowUpdate.c7 === '' || rowUpdate.c7 === undefined || rowUpdate.c7 === null ? null : parseInt(rowUpdate.c7, 10),
          c8: rowUpdate.c8 === '' || rowUpdate.c8 === undefined || rowUpdate.c8 === null ? null : parseInt(rowUpdate.c8, 10),
          c9: rowUpdate.c9 === '' || rowUpdate.c9 === undefined || rowUpdate.c9 === null ? null : parseInt(rowUpdate.c9, 10)
        };
      });

      // Clear any NaNs in rows
      rowsToUpsert.forEach((row: any) => {
        Object.keys(row).forEach(key => {
          if (row[key] !== null && typeof row[key] === 'number' && isNaN(row[key])) {
            row[key] = null;
          }
        });
      });

      const { error: rowsErr } = await supabase
        .from('card_rows')
        .upsert(rowsToUpsert, { onConflict: 'card_id,row_no' });

      if (rowsErr) throw rowsErr;
    }

    // 4. Fetch full updated set for validation report
    const { data: updatedSet, error: fetchErr } = await supabase
      .from('sets')
      .select(`
        set_no,
        cards (
          card_no,
          card_rows (
            row_no,
            c1, c2, c3, c4, c5, c6, c7, c8, c9
          )
        )
      `)
      .eq('set_no', parsedSetNo)
      .single();

    if (fetchErr) throw fetchErr;

    const rawRowsForValidation: any[] = [];
    updatedSet.cards.forEach((c: any) => {
      c.card_rows.forEach((r: any) => {
        rawRowsForValidation.push({
          set_no: updatedSet.set_no,
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
          c9: r.c9
        });
      });
    });

    const validationReport = validateTambolaData(rawRowsForValidation);

    return NextResponse.json({
      success: true,
      message: 'تم حفظ السيت بالكامل بنجاح في Supabase وإجراء الفحص التلقائي',
      validationReport
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء حفظ السيت بالكامل في Supabase: ' + error.message },
      { status: 500 }
    );
  }
}
