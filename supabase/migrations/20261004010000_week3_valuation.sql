-- Week 3, Days 6-7: the three valuation views, visible only to accounts given access.
--
-- Per-stock values sit close to a "price target" under SEBI's Research Analyst rules, so until
-- that question is settled only accounts listed in feature_access see them. Friends see RSI and
-- everything else.
--
-- feature_access   which account may see which gated feature. No one can add themselves: there is
--                  no insert or update grant; add a row from the SQL editor. This migration grants
--                  'valuation' to the first account that signed up (the owner).
-- valuation_views  one row per account and held stock, rewritten nightly by
--                  jobs/compute_valuations.py for accounts with 'valuation' access only, using
--                  that account's discount rate and terminal growth from settings.
-- settings gains valuation_discount_pct and valuation_terminal_pct (the reverse DCF's two inputs).

create table if not exists public.feature_access (
  user_id     uuid not null references public.users (id) on delete cascade,
  feature     text not null check (feature in ('valuation')),
  granted_at  timestamptz not null default now(),
  primary key (user_id, feature)
);

-- auth.users.created_at is the real sign-up time (public.users rows made by Day 3's backfill share one timestamp)
insert into public.feature_access (user_id, feature)
select u.id, 'valuation' from public.users u join auth.users a on a.id = u.id order by a.created_at asc limit 1
on conflict do nothing;

-- true when the signed-in account has this feature; used by the policies below and by the app
create or replace function public.has_feature(p_feature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.feature_access f where f.user_id = auth.uid() and f.feature = p_feature)
$$;
revoke all on function public.has_feature(text) from public, anon;
grant execute on function public.has_feature(text) to authenticated;

alter table public.settings
  add column if not exists valuation_discount_pct numeric(5,2) not null default 12
    check (valuation_discount_pct between 4 and 30),
  add column if not exists valuation_terminal_pct numeric(5,2) not null default 5
    check (valuation_terminal_pct between 0 and 10);
alter table public.settings drop constraint if exists valuation_rates_order;
alter table public.settings add constraint valuation_rates_order check (valuation_terminal_pct < valuation_discount_pct);
grant update (valuation_discount_pct, valuation_terminal_pct) on public.settings to authenticated;

create table if not exists public.valuation_views (
  user_id        uuid not null references public.users (id) on delete cascade,
  symbol         text not null,               -- NSE symbol
  computed_at    timestamptz not null default now(),
  price          numeric,                     -- last NSE close used
  price_date     date,
  basis          text,                        -- 'consolidated' or 'standalone'
  financial      boolean not null default false, -- bank or financial company: reverse DCF skipped
  pe             jsonb not null default '{}'::jsonb,       -- P/E history view: value, band, inputs, or missing
  graham         jsonb not null default '{}'::jsonb,       -- Graham number view
  reverse_dcf    jsonb not null default '{}'::jsonb,       -- implied growth view
  past_growth    jsonb not null default '{}'::jsonb,       -- what the company actually grew
  sources        jsonb not null default '[]'::jsonb,       -- [{period_end, url}] filings used
  primary key (user_id, symbol)
);

alter table public.feature_access  enable row level security;
alter table public.valuation_views enable row level security;
revoke all on public.feature_access, public.valuation_views from anon;
revoke all on public.feature_access, public.valuation_views from authenticated;
grant select on public.feature_access, public.valuation_views to authenticated;

drop policy if exists "feature_access: read own" on public.feature_access;
create policy "feature_access: read own" on public.feature_access for select to authenticated
  using (user_id = (select auth.uid()));

-- Your own rows, and only while you still have access (removing access hides them at once)
drop policy if exists "valuation_views: read own with access" on public.valuation_views;
create policy "valuation_views: read own with access" on public.valuation_views for select to authenticated
  using (user_id = (select auth.uid()) and (select public.has_feature('valuation')));
