export interface ValidationError {
  setNo?: number;
  cardNo?: number;
  rowNo?: number;
  errorType: string;
  message: string;
  offendingValue?: string | number;
}

export interface ValidatedSet {
  setNo: number;
  cards: {
    cardNo: number;
    rows: {
      rowNo: number;
      c1: number | null;
      c2: number | null;
      c3: number | null;
      c4: number | null;
      c5: number | null;
      c6: number | null;
      c7: number | null;
      c8: number | null;
      c9: number | null;
    }[];
  }[];
}

export interface ValidationReport {
  isValid: boolean;
  errors: ValidationError[];
  validatedSets: ValidatedSet[];
}

export function validateTambolaData(rawRows: any[]): ValidationReport {
  const errors: ValidationError[] = [];
  const validatedSets: ValidatedSet[] = [];

  // Group raw rows by set_no
  const setsMap = new Map<number, any[]>();

  rawRows.forEach((row, index) => {
    const setNoRaw = row.set_no ?? row.SetNo ?? row.setNo;
    const cardNoRaw = row.card_no ?? row.CardNo ?? row.cardNo;
    const rowNoRaw = row.row_no ?? row.RowNo ?? row.rowNo;

    // Skip empty lines
    if (setNoRaw === undefined || setNoRaw === '') return;

    const setNo = parseInt(setNoRaw, 10);
    const cardNo = parseInt(cardNoRaw, 10);
    const rowNo = parseInt(rowNoRaw, 10);

    if (isNaN(setNo)) {
      errors.push({
        errorType: 'بيانات غير صالحة',
        message: `السطر ${index + 2}: رقم السيت غير صالح (${setNoRaw})`,
        offendingValue: setNoRaw
      });
      return;
    }

    if (!setsMap.has(setNo)) {
      setsMap.set(setNo, []);
    }
    setsMap.get(setNo)!.push({
      originalIndex: index + 2,
      setNo,
      cardNo,
      rowNo,
      c1: parseCellValue(row.c1),
      c2: parseCellValue(row.c2),
      c3: parseCellValue(row.c3),
      c4: parseCellValue(row.c4),
      c5: parseCellValue(row.c5),
      c6: parseCellValue(row.c6),
      c7: parseCellValue(row.c7),
      c8: parseCellValue(row.c8),
      c9: parseCellValue(row.c9),
    });
  });

  // Validate each set
  setsMap.forEach((rows, setNo) => {
    const setErrorsCountBefore = errors.length;

    // 1. Check if set contains exactly 18 rows
    if (rows.length !== 18) {
      errors.push({
        setNo,
        errorType: 'عدد أسطر غير صحيح في السيت',
        message: `السيت رقم ${setNo} يحتوي على ${rows.length} أسطر بدلاً من 18 سطر (6 بطاقات × 3 أسطر)`,
        offendingValue: rows.length
      });
    }

    // Group rows by card_no
    const cardsMap = new Map<number, any[]>();
    rows.forEach(r => {
      const cardNo = r.cardNo;
      if (isNaN(cardNo) || cardNo < 1 || cardNo > 6) {
        errors.push({
          setNo,
          cardNo: isNaN(cardNo) ? undefined : cardNo,
          rowNo: r.rowNo,
          errorType: 'رقم بطاقة غير صالح',
          message: `السيت ${setNo}: رقم بطاقة غير صالح (${r.cardNo})، يجب أن يكون بين 1 و 6`,
          offendingValue: r.cardNo
        });
        return;
      }
      if (!cardsMap.has(cardNo)) {
        cardsMap.set(cardNo, []);
      }
      cardsMap.get(cardNo)!.push(r);
    });

    const setNumbers: number[] = [];
    const setCards: ValidatedSet['cards'] = [];

    // Check each card (1 to 6)
    for (let c = 1; c <= 6; c++) {
      const cardRows = cardsMap.get(c) || [];
      const cardErrorsCountBefore = errors.length;

      if (cardRows.length !== 3) {
        // Only log if we have this card's rows but not exactly 3
        if (cardRows.length > 0) {
          errors.push({
            setNo,
            cardNo: c,
            errorType: 'عدد أسطر غير صحيح في البطاقة',
            message: `السيت ${setNo} - البطاقة ${c}: تحتوي على ${cardRows.length} أسطر بدلاً من 3 أسطر`,
            offendingValue: cardRows.length
          });
        } else {
          errors.push({
            setNo,
            cardNo: c,
            errorType: 'بطاقة مفقودة',
            message: `السيت ${setNo}: البطاقة رقم ${c} مفقودة تماماً في الملف`,
          });
        }
        continue;
      }

      // Sort rows by row_no
      cardRows.sort((a, b) => a.rowNo - b.rowNo);

      const validatedCardRows: any[] = [];
      let cardNumbersCount = 0;

      // Validate each row of the card
      for (let rIndex = 1; rIndex <= 3; rIndex++) {
        // Find row with rowNo == rIndex
        const row = cardRows.find(r => r.rowNo === rIndex);
        if (!row) {
          errors.push({
            setNo,
            cardNo: c,
            rowNo: rIndex,
            errorType: 'سطر مفقود',
            message: `السيت ${setNo} - البطاقة ${c}: السطر رقم ${rIndex} مفقود`,
          });
          continue;
        }

        // Count non-empty values in c1..c9
        const cols = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'];
        let rowNumbersCount = 0;
        const rowObj: any = { rowNo: rIndex };

        cols.forEach((col, idx) => {
          const val = row[col];
          rowObj[col] = val;

          if (val !== null) {
            rowNumbersCount++;
            cardNumbersCount++;
            setNumbers.push(val);

            // Validate number range (1 - 90)
            if (val < 1 || val > 90) {
              errors.push({
                setNo,
                cardNo: c,
                rowNo: rIndex,
                errorType: 'رقم خارج النطاق',
                message: `السيت ${setNo} - البطاقة ${c} - السطر ${rIndex}: الرقم ${val} في العمود ${col.toUpperCase()} خارج النطاق المسموح به (1-90)`,
                offendingValue: val
              });
            }

            // Validate column placement rules
            const colMin = idx === 0 ? 1 : idx * 10;
            const colMax = idx === 8 ? 90 : (idx * 10) + 9;
            if (val < colMin || val > colMax) {
              errors.push({
                setNo,
                cardNo: c,
                rowNo: rIndex,
                errorType: 'توزيع أعمدة خاطئ',
                message: `السيت ${setNo} - البطاقة ${c} - السطر ${rIndex}: الرقم ${val} موضوع في العمود ${col.toUpperCase()} وهو خاطئ (العمود الصحيح يجب أن يحتوي على أرقام بين ${colMin} و ${colMax})`,
                offendingValue: val
              });
            }
          }
        });

        // Check if row has exactly 5 numbers
        if (rowNumbersCount !== 5) {
          errors.push({
            setNo,
            cardNo: c,
            rowNo: rIndex,
            errorType: 'توزيع أرقام غير سليم في السطر',
            message: `السيت ${setNo} - البطاقة ${c} - السطر ${rIndex}: يحتوي السطر على ${rowNumbersCount} أرقام بدلاً من 5 أرقام (و 4 فراغات)`,
            offendingValue: rowNumbersCount
          });
        }

        validatedCardRows.push(rowObj);
      }

      // Check if card has exactly 15 numbers
      if (cardNumbersCount !== 15 && cardErrorsCountBefore === errors.length) {
        errors.push({
          setNo,
          cardNo: c,
          errorType: 'عدد أرقام غير صحيح في البطاقة',
          message: `السيت ${setNo} - البطاقة ${c}: تحتوي البطاقة على ${cardNumbersCount} أرقام بدلاً من 15 رقم`,
          offendingValue: cardNumbersCount
        });
      }

      setCards.push({
        cardNo: c,
        rows: validatedCardRows
      });
    }

    // Validate entire set numbers (1 to 90 exactly once)
    if (errors.length === setErrorsCountBefore) {
      // Check duplicates in the set
      const duplicates = setNumbers.filter((item, index) => setNumbers.indexOf(item) !== index);
      if (duplicates.length > 0) {
        // Unique duplicates
        const uniqueDups = Array.from(new Set(duplicates));
        errors.push({
          setNo,
          errorType: 'أرقام مكررة في السيت',
          message: `السيت ${setNo}: يحتوي على أرقام مكررة وهي: [${uniqueDups.join(', ')}]`,
          offendingValue: uniqueDups.join(', ')
        });
      }

      // Check missing numbers in the set (1 to 90)
      const missing: number[] = [];
      for (let n = 1; n <= 90; n++) {
        if (!setNumbers.includes(n)) {
          missing.push(n);
        }
      }
      if (missing.length > 0) {
        errors.push({
          setNo,
          errorType: 'أرقام مفقودة في السيت',
          message: `السيت ${setNo}: يفتقد الأرقام التالية: [${missing.join(', ')}]`,
          offendingValue: missing.join(', ')
        });
      }
    }

    validatedSets.push({
      setNo,
      cards: setCards
    });
  });

  // Sort validated sets by setNo
  validatedSets.sort((a, b) => a.setNo - b.setNo);

  return {
    isValid: errors.length === 0,
    errors,
    validatedSets
  };
}

function parseCellValue(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
}
