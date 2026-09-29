-- Day 3: users, settings, kite_tokens, holdings_snapshot, with row-level security.
-- Run once in Supabase → SQL Editor (or `supabase db push`). Safe to re-run.
--
-- Who can do what
--   Signed-in users (role "authenticated") read and change only their own rows.
--   Signed-out visitors (role "anon") can read nothing.
--   The API writes Kite tokens and holdings with the secret key, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- users: one row per Google account, created automatically on first sign-in
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- settings: one row per user, defaults filled in on first sign-in
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  user_id                    uuid primary key references public.users (id) on delete cascade,
  benchmark                  text not null default 'NIFTY 500'
                               check (benchmark in ('NIFTY 50', 'NIFTY 500', 'NIFTY MIDCAP 150', 'NIFTY SMALLCAP 250')),
  -- Share of the portfolio you want in index funds, as a band (percent)
  index_target_low           numeric(5,2) not null default 20 check (index_target_low between 0 and 100),
  index_target_high          numeric(5,2) not null default 40 check (index_target_high between 0 and 100),
  -- Rupees you plan to invest each month; empty until you set it
  monthly_amount             numeric(14,2) check (monthly_amount is null or monthly_amount >= 0),
  -- Alert thresholds (percent)
  alert_stock_weight_pct     numeric(5,2) not null default 10 check (alert_stock_weight_pct between 1 and 100),
  alert_sector_weight_pct    numeric(5,2) not null default 30 check (alert_sector_weight_pct between 1 and 100),
  alert_weakening_share_pct  numeric(5,2) not null default 40 check (alert_weakening_share_pct between 1 and 100),
  alert_day_move_pct         numeric(5,2) not null default 5  check (alert_day_move_pct between 0.5 and 50),
  updated_at                 timestamptz not null default now(),
  constraint index_band_order check (index_target_low <= index_target_high)
);

-- ---------------------------------------------------------------------------
-- kite_tokens: the daily Kite access token, encrypted by the API (Day 4)
-- ---------------------------------------------------------------------------
create table if not exists public.kite_tokens (
  user_id           uuid primary key references public.users (id) on delete cascade,
  kite_user_id      text,
  access_token_enc  text not null,          -- Fernet ciphertext; the key lives only on the API
  expires_at        timestamptz not null,   -- 6 AM IST the next day
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- holdings_snapshot: a dated copy of what Kite returned (Day 5)
-- ---------------------------------------------------------------------------
create table if not exists public.holdings_snapshot (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.users (id) on delete cascade,
  taken_at    timestamptz not null default now(),
  holdings    jsonb not null default '[]'::jsonb,
  positions   jsonb not null default '[]'::jsonb,
  totals      jsonb not null default '{}'::jsonb
);
create index if not exists holdings_snapshot_user_taken on public.holdings_snapshot (user_id, taken_at desc);

-- ---------------------------------------------------------------------------
-- Keep settings.updated_at current
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- First sign-in: create the users row and a settings row with defaults
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed in before this migration ran
insert into public.users (id, email, full_name, avatar_url)
select id, coalesce(email, ''),
       coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
       raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;
insert into public.settings (user_id) select id from public.users on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Delete everything: removes the sign-in account; every table above cascades
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.users             enable row level security;
alter table public.settings          enable row level security;
alter table public.kite_tokens       enable row level security;
alter table public.holdings_snapshot enable row level security;

-- Signed-out visitors get nothing at all
revoke all on public.users, public.settings, public.kite_tokens, public.holdings_snapshot from anon;

-- users: read and edit your own name
drop policy if exists "users: read own"   on public.users;
drop policy if exists "users: update own" on public.users;
create policy "users: read own"   on public.users for select to authenticated using (id = (select auth.uid()));
create policy "users: update own" on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- settings: read and edit your own row (created by the trigger, so no insert policy)
drop policy if exists "settings: read own"   on public.settings;
drop policy if exists "settings: update own" on public.settings;
create policy "settings: read own"   on public.settings for select to authenticated using (user_id = (select auth.uid()));
create policy "settings: update own" on public.settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- kite_tokens: you may see whether you're connected and when it expires, never the token itself
revoke all on public.kite_tokens from authenticated;
grant select (user_id, kite_user_id, expires_at, updated_at) on public.kite_tokens to authenticated;
drop policy if exists "kite_tokens: read own" on public.kite_tokens;
create policy "kite_tokens: read own" on public.kite_tokens for select to authenticated using (user_id = (select auth.uid()));

-- holdings_snapshot: read and delete your own; the API inserts
revoke all on public.holdings_snapshot from authenticated;
drop policy if exists "holdings: read own"   on public.holdings_snapshot;
drop policy if exists "holdings: delete own" on public.holdings_snapshot;
create policy "holdings: read own"   on public.holdings_snapshot for select to authenticated using (user_id = (select auth.uid()));
create policy "holdings: delete own" on public.holdings_snapshot for delete to authenticated using (user_id = (select auth.uid()));

-- Nobody changes ids or owners from the browser: only these columns are editable
revoke insert, update, delete on public.users, public.settings from authenticated;
grant select on public.users, public.settings to authenticated;
grant update (full_name) on public.users to authenticated;
grant update (benchmark, index_target_low, index_target_high, monthly_amount,
              alert_stock_weight_pct, alert_sector_weight_pct, alert_weakening_share_pct, alert_day_move_pct)
  on public.settings to authenticated;
grant select, delete on public.holdings_snapshot to authenticated;
