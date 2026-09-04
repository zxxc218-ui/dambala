-- ===========================================================================
-- الدمبلة العراقية — جداول المستخدمين وفصل جلسات النوادي
-- شغّل هذا الملف مرة واحدة في: Supabase → SQL Editor → Run
-- ===========================================================================

-- 1) حسابات الدخول ----------------------------------------------------------
create table if not exists public.app_users (
  id            bigserial primary key,
  username      text not null unique,
  password_hash text not null,
  role          text not null check (role in ('super_admin', 'club')),
  club_name     text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists app_users_username_idx on public.app_users (username);

-- كلمات السر مشفّرة، ومع ذلك الجدول مقفول تماماً بوجه مفتاح anon العلني:
-- لا سياسة = لا وصول. السيرفر يقراه بمفتاح service_role.
alter table public.app_users enable row level security;

-- 2) كل نادي وجلساته -------------------------------------------------------
alter table public.draw_sessions
  add column if not exists club_id bigint references public.app_users(id) on delete set null;

create index if not exists draw_sessions_club_status_idx
  on public.draw_sessions (club_id, status);

-- 3) فهارس تسريع ------------------------------------------------------------
create index if not exists draw_numbers_session_idx     on public.draw_numbers (session_id);
create index if not exists draw_numbers_session_num_idx on public.draw_numbers (session_id, number);
create index if not exists cards_set_idx                on public.cards (set_id);
create index if not exists card_rows_card_idx           on public.card_rows (card_id);

-- 4) السماح بالحذف (إذا ما سويتها من قبل) -----------------------------------
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'draw_numbers'
                   and cmd = 'DELETE') then
    execute 'create policy "allow delete draw_numbers" on public.draw_numbers for delete using (true)';
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'sets'
                   and cmd = 'DELETE') then
    execute 'create policy "allow delete sets" on public.sets for delete using (true)';
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'draw_sessions'
                   and cmd = 'DELETE') then
    execute 'create policy "allow delete draw_sessions" on public.draw_sessions for delete using (true)';
  end if;
end $$;

-- 5) جدول profiles القديم ما عاد مستعملاً (كان يخزن كلمات السر نصاً صريحاً).
--    بعد ما تتأكد إن الدخول الجديد شغال، احذفه:
-- drop table if exists public.profiles;
