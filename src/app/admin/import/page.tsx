'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { validateTambolaData, ValidationError, ValidatedSet } from '@/lib/validation';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { FileDown, Upload, CheckCircle2, AlertOctagon, HelpCircle, ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ImportPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // Validation State
  const [validationRun, setValidationRun] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [validatedSets, setValidatedSets] = useState<ValidatedSet[]>([]);
  const [dbMessage, setDbMessage] = useState('');

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        setIsAdmin(data.authenticated);
      } catch (err) {
        setIsAdmin(false);
      }
    }
    checkAuth();
  }, []);

  if (isAdmin === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '8px' }}>
        <Loader2 className="animate-spin" size={24} />
        <span>جاري التحقق من صلاحيات الدخول...</span>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <>
        <Navbar />
        <div className="container" style={{ maxWidth: '600px', padding: '60px 16px' }}>
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <ShieldAlert size={64} style={{ color: 'var(--danger)', margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '12px' }}>غير مصرح بالدخول</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
              هذه الصفحة مخصصة لمدير النظام فقط لرفع وتحديث سيتات الدمبلة. يرجى تسجيل الدخول أولاً للوصول.
            </p>
            <Link href="/login" className="btn btn-primary">
              تسجيل الدخول كمسؤول
            </Link>
          </div>
        </div>
      </>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      resetValidationState();
    }
  };

  const resetValidationState = () => {
    setValidationRun(false);
    setIsValid(false);
    setErrors([]);
    setValidatedSets([]);
    setDbMessage('');
  };

  const handleValidate = () => {
    if (!file) return;
    setValidating(true);
    resetValidationState();

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processParsedData(results.data);
        },
        error: (err) => {
          setErrors([{ errorType: 'خطأ في قراءة الملف', message: err.message }]);
          setIsValid(false);
          setValidationRun(true);
          setValidating(false);
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          processParsedData(json);
        } catch (err: any) {
          setErrors([{ errorType: 'خطأ في قراءة ملف Excel', message: err.message }]);
          setIsValid(false);
          setValidationRun(true);
          setValidating(false);
        }
      };
      reader.onerror = () => {
        setErrors([{ errorType: 'خطأ في قراءة ملف Excel', message: 'فشل تحميل الملف' }]);
        setIsValid(false);
        setValidationRun(true);
        setValidating(false);
      };
      reader.readAsArrayBuffer(file);
    } else {
      setErrors([{ errorType: 'صيغة غير مدعومة', message: 'الرجاء رفع ملف Excel أو CSV فقط' }]);
      setIsValid(false);
      setValidationRun(true);
      setValidating(false);
    }
  };

  const processParsedData = (data: any[]) => {
    // Normalise column names to lowercase to avoid case mismatch (Set_No, set_no, c1, C1)
    const normalisedData = data.map(row => {
      const normalised: any = {};
      Object.keys(row).forEach(key => {
        normalised[key.toLowerCase()] = row[key];
      });
      return normalised;
    });

    const report = validateTambolaData(normalisedData);
    setIsValid(report.isValid);
    setErrors(report.errors);
    setValidatedSets(report.validatedSets);
    setValidationRun(true);
    setValidating(false);
  };

  const handleImport = async () => {
    if (!isValid || validatedSets.length === 0) return;
    setImporting(true);
    setDbMessage('');

    try {
      const res = await fetch('/api/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sets: validatedSets }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setDbMessage(data.message);
        // Show success and redirect after 2s
        setTimeout(() => {
          router.push('/admin/sets');
        }, 1500);
      } else {
        setDbMessage(`خطأ أثناء حفظ البيانات: ${data.message}`);
      }
    } catch (err) {
      setDbMessage('تعذر الاتصال بالخادم لحفظ السيتات');
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="container" style={{ maxWidth: '900px', paddingBottom: '60px' }}>
        
        {/* Breadcrumb / Back button */}
        <div style={{ marginBottom: '24px' }}>
          <Link href="/admin/sets" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: '700', fontSize: '14px' }}>
            <ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} /> العودة لإدارة السيتات
          </Link>
        </div>

        <div className="card" style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <FileDown style={{ color: 'var(--primary)' }} /> استيراد وتوزيع السيتات والبطاقات
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
            ارفع ملف CSV أو Excel يحتوي على توزيع الأرقام الحقيقي للدمبلة.
            سيقوم النظام بإجراء <strong>10 فحوصات ذكية للتحقق</strong> من دقة التوزيع، وسيعرض تقريراً تفصيلياً بأي أرقام مكررة أو موضوعة في أعمدة خاطئة قبل حفظها.
          </p>

          {/* Import Instructions Accordion */}
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            padding: '16px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '24px'
          }}>
            <h4 style={{ fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <HelpCircle size={16} /> صيغة الملف المطلوبة (الترتيب والأعمدة)
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              يجب أن يحتوي الملف على ترويسة الأعمدة التالية بالتمام:
            </p>
            <code style={{
              display: 'block',
              background: '#e2e8f0',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              direction: 'ltr',
              textAlign: 'left',
              marginTop: '6px',
              fontFamily: 'monospace'
            }}>
              set_no, card_no, row_no, c1, c2, c3, c4, c5, c6, c7, c8, c9
            </code>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
              * كل سيت يحتوي على 6 بطاقات، وكل بطاقة 3 أسطر. كل سطر يحتوي على 5 أرقام و 4 خانات فارغة. الأرقام بين 1 و 90.
            </p>
          </div>

          {/* File Upload Selector */}
          <div style={{
            border: '2px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '40px 20px',
            textAlign: 'center',
            background: file ? 'var(--primary-light)' : 'transparent',
            borderColor: file ? 'var(--primary)' : 'var(--border)',
            transition: 'all 0.2s',
            position: 'relative'
          }}>
            <input
              type="file"
              id="csv-file-input"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer'
              }}
              disabled={validating || importing}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <Upload size={40} style={{ color: file ? 'var(--primary)' : 'var(--text-muted)' }} />
              <div>
                <span style={{ fontWeight: '700', fontSize: '15px' }}>
                  {file ? file.name : 'اسحب وأفلت ملف الـ CSV/Excel هنا أو انقر لاختياره'}
                </span>
                {file && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    حجم الملف: {(file.size / 1024).toFixed(2)} كيلوبايت
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
            {file && !validationRun && (
              <button
                onClick={handleValidate}
                className="btn btn-primary"
                disabled={validating}
              >
                {validating ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> جاري الفحص...
                  </>
                ) : 'افحص الملف للتحقق'}
              </button>
            )}

            {isValid && validationRun && (
              <button
                onClick={handleImport}
                className="btn btn-secondary"
                disabled={importing}
                style={{ background: '#2ecc71' }}
              >
                {importing ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> جاري الحفظ...
                  </>
                ) : 'تأكيد الاستيراد والحفظ'}
              </button>
            )}

            {validationRun && (
              <button onClick={resetValidationState} className="btn btn-outline" disabled={importing}>
                إلغاء وإعادة الاختيار
              </button>
            )}
          </div>
        </div>

        {/* Database import message */}
        {dbMessage && (
          <div style={{
            background: dbMessage.startsWith('خطأ') ? 'var(--danger-light)' : 'var(--primary-light)',
            color: dbMessage.startsWith('خطأ') ? 'var(--danger)' : 'var(--primary)',
            border: '1px solid currentColor',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            fontWeight: '700',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            {dbMessage}
          </div>
        )}

        {/* Validation Results Report */}
        {validationRun && (
          <div className="card">
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              تقرير التحقق والتحليل للملف المرفوع
            </h3>

            {isValid ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--primary)', background: 'var(--primary-light)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '24px' }}>
                  <CheckCircle2 size={24} style={{ flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontWeight: '700' }}>الملف سليم 100%!</h4>
                    <p style={{ fontSize: '13px', marginTop: '2px' }}>
                      تمت مطابقة جميع الفحوصات بنجاح. يحتوي الملف على <strong>{validatedSets.length}</strong> سيتات دمبلة موزعة كروت رقمية صحيحة بدون أخطاء. يمكنك تأكيد الحفظ الآن.
                    </p>
                  </div>
                </div>

                {/* Preview Table */}
                <h4 style={{ fontWeight: '700', fontSize: '15px', marginBottom: '12px' }}>معاينة السيتات المستوردة:</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ padding: '10px' }}>رقم السيت (Set No)</th>
                        <th style={{ padding: '10px' }}>عدد البطاقات</th>
                        <th style={{ padding: '10px' }}>إجمالي الأرقام</th>
                        <th style={{ padding: '10px' }}>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validatedSets.slice(0, 10).map((set) => (
                        <tr key={set.setNo} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px', fontWeight: '700' }}>{set.setNo}</td>
                          <td style={{ padding: '10px' }}>{set.cards.length} بطاقات</td>
                          <td style={{ padding: '10px' }}>90 رقم (كاملة)</td>
                          <td style={{ padding: '10px', color: 'var(--primary)', fontWeight: '700' }}>سليم ✅</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validatedSets.length > 10 && (
                    <div style={{ textAlign: 'center', padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      و {validatedSets.length - 10} سيتات أخرى...
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--danger)', background: 'var(--danger-light)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '24px' }}>
                  <AlertOctagon size={24} style={{ flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontWeight: '700' }}>تم اكتشاف أخطاء في توزيع الملف!</h4>
                    <p style={{ fontSize: '13px', marginTop: '2px' }}>
                      الرجاء تصحيح المشاكل المذكورة في الجدول أدناه قبل رفع الملف إلى النظام. لا يسمح باستيراد ملفات تحتوي على بيانات خاطئة.
                    </p>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ padding: '12px', width: '90px' }}>رقم السيت</th>
                        <th style={{ padding: '12px', width: '90px' }}>رقم البطاقة</th>
                        <th style={{ padding: '12px', width: '90px' }}>رقم السطر</th>
                        <th style={{ padding: '12px', width: '180px' }}>نوع الخطأ</th>
                        <th style={{ padding: '12px' }}>تفاصيل المشكلة</th>
                        <th style={{ padding: '12px', width: '120px' }}>القيمة المخالفة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errors.map((error, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px', fontWeight: '700' }}>{error.setNo ?? '-'}</td>
                          <td style={{ padding: '12px' }}>{error.cardNo ?? '-'}</td>
                          <td style={{ padding: '12px' }}>{error.rowNo ?? '-'}</td>
                          <td style={{ padding: '12px', color: 'var(--danger)', fontWeight: '700' }}>{error.errorType}</td>
                          <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{error.message}</td>
                          <td style={{ padding: '12px', fontWeight: '700', color: 'var(--danger)', fontFamily: 'monospace' }}>
                            {error.offendingValue !== undefined ? error.offendingValue : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
