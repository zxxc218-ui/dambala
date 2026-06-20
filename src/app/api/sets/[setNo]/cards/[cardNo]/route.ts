import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';
import { validateTambolaData } from '@/lib/validation';

function validateCardLayout(rows: any[], cardNo: number, setNo: number) {
  const errors: string[] = [];
  
  if (!rows || rows.length !== 3) {
    errors.push(`يجب أن تحتوي البطاقة على 3 أسطر بالتمام`);
    return errors;
  }

  let cardNumbersCount = 0;

  for (const row of rows) {
    const rowNo = parseInt(row.rowNo, 10);
    if (isNaN(rowNo) || rowNo < 1 || rowNo > 3) {
      errors.push(`رقم السطر غير صالح: ${row.rowNo}`);
      continue;
    }

    const cols = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'];
    let rowNumbersCount = 0;

    cols.forEach((col, idx) => {
      const rawVal = row[col];
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        const val = parseInt(rawVal, 10);
        if (isNaN(val)) {
          errors.push(`السطر ${rowNo}: القيمة في العمود ${col.toUpperCase()} ليست رقماً صالحاً`);
          return;
        }

        rowNumbersCount++;
        cardNumbersCount++;

        if (val < 1 || val > 90) {
          errors.push(`السطر ${rowNo}: الرقم ${val} خارج النطاق المسموح به (1-90)`);
        }

        const colMin = idx === 0 ? 1 : idx * 10;
        const colMax = idx === 8 ? 90 : (idx * 10) + 9;
        if (val < colMin || val > colMax) {
          errors.push(`السطر ${rowNo}: الرقم ${val} موضوع في العمود ${col.toUpperCase()} بشكل خاطئ (يجب أن يكون بين ${colMin} و ${colMax})`);
        }
      }
    });

    if (rowNumbersCount !== 5) {
      errors.push(`السطر ${rowNo} يحتوي على ${rowNumbersCount} أرقام بدلاً من 5 أرقام (و 4 فراغات)`);
    }
  }

  if (cardNumbersCount !== 15 && errors.length === 0) {
    errors.push(`تحتوي البطاقة على ${cardNumbersCount} أرقام بدلاً من 15 رقم`);
  }

  return errors;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ setNo: string; cardNo: string }> }
) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json(
        { success: false, message: 'غير مصرح لك بالقيام بهذا الإجراء' },
        { status: 403 }
      );
    }

    const { setNo, cardNo } = await params;
    const parsedSetNo = parseInt(setNo, 10);
    const parsedCardNo = parseInt(cardNo, 10);

    if (isNaN(parsedSetNo) || isNaN(parsedCardNo)) {
      return NextResponse.json(
        { success: false, message: 'معاملات الطلب غير صالحة' },
        { status: 400 }
      );
    }

    const { rows } = await req.json();
    
    // 1. Validate Card Layout
    const layoutErrors = validateCardLayout(rows, parsedCardNo, parsedSetNo);
    if (layoutErrors.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'فشل حفظ البطاقة لوجود أخطاء في بنية التوزيع',
          errors: layoutErrors
        },
        { status: 400 }
      );
    }

    // 2. Ensure Set exists in Supabase
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

    // 3. Ensure Card exists in Supabase
    let cardId: string;
    const { data: existingCard } = await supabase
      .from('cards')
      .select('id')
      .eq('set_id', setId)
      .eq('card_no', parsedCardNo)
      .maybeSingle();

    if (existingCard) {
      cardId = existingCard.id;
    } else {
      const { data: newCard, error: cardErr } = await supabase
        .from('cards')
        .insert({ set_id: setId, card_no: parsedCardNo })
        .select('id')
        .single();

      if (cardErr || !newCard) throw cardErr || new Error('فشل إنشاء الكرت');
      cardId = newCard.id;
    }

    // 4. Upsert Rows
    const rowsToUpsert = rows.map((rowUpdate: any) => {
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

    // Clear NaNs
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

    // 5. Fetch full updated set for validation report
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
      message: 'تم حفظ البطاقة بنجاح وإعادة فحص السيت',
      validationReport
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء تحديث البطاقة في Supabase: ' + error.message },
      { status: 500 }
    );
  }
}
