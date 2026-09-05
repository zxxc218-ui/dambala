-- =====================================================================
--  قسم الجوائز — شغّل هذا السكربت مرة وحدة في Supabase → SQL Editor
-- =====================================================================
--  يضيف عمود واحد على جدول الجلسات يخزن إعدادات جوائز كل جلسة:
--  أي خط مفعّل، وكم مرة يفوز.
--
--  مثال المحتوى:
--  {
--    "row1":     { "enabled": true,  "count": 3 },
--    "row2":     { "enabled": true,  "count": 2 },
--    "row3":     { "enabled": false, "count": 1 },
--    "corners":  { "enabled": true,  "count": 2 },
--    "fullCard": { "enabled": true,  "count": 1 }
--  }
-- ---------------------------------------------------------------------

alter table public.draw_sessions
  add column if not exists prizes jsonb;

comment on column public.draw_sessions.prizes is
  'إعدادات جوائز الجلسة: تفعيل كل جائزة وعدد الفائزين المسموح به قبل ما تنسد.';
