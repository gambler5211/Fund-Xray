-- Week 3, Day 1: a weekly record of your holdings, your alignment per week, and the market's.
--
-- holdings_weekly    one row per user per week: the last holdings snapshot taken that week,
--                    each holding with its value, share, sector and sector index
-- alignment_weekly   one row per user, week and benchmark: your money by quadrant that week
-- market_alignment   one row per week and benchmark: the share of Nifty 500 stocks in each
--                    quadrant (counts stocks, since NSE's lists carry no weights)
--
-- Written only by jobs/compute_alignment.py with the secret key. You read your own rows;
-- market_alignment is readable by every signed-in user. Deleting your account removes yours.

create table if not exists public.holdings_weekly (
  user_id     uuid not null references public.users (id) on delete cascade,
  week_start  date not null,                 -- Monday of the week
  taken_at    timestamptz not null,          -- the snapshot this came from
  value       numeric not null,
  holdings    jsonb not null default '[]'::jsonb,  -- [{symbol, name, value, share, industry, index_key}]
  primary key (user_id, week_start)
);

create table if not exists public.alignment_weekly (
  user_id         uuid not null references public.users (id) on delete cascade,
  week_start      date not null,
  benchmark_key   text not null references public.tracked_indices (key) on delete cascade,
  date            date not null,             -- the week's last trading day (the rotation point)
  leading         numeric not null,          -- % of your money in each quadrant
  improving       numeric not null,
  weakening       numeric not null,
  lagging         numeric not null,
  unmapped        numeric not null,          -- % in sectors without an index, funds, or unmapped
  gaining         numeric not null,          -- leading + improving
  losing          numeric not null,          -- weakening + lagging
  gaining_if_still numeric,                  -- this week's holdings with last week's quadrants
  primary key (user_id, week_start, benchmark_key)
);

create table if not exists public.market_alignment (
  week_start     date not null,
  benchmark_key  text not null references public.tracked_indices (key) on delete cascade,
  date           date not null,
  stocks         int not null,               -- Nifty 500 stocks whose sector has an index
  leading        numeric not null,           -- % of those stocks in each quadrant
  improving      numeric not null,
  weakening      numeric not null,
  lagging        numeric not null,
  gaining        numeric not null,
  losing         numeric not null,
  primary key (week_start, benchmark_key)
);

alter table public.holdings_weekly  enable row level security;
alter table public.alignment_weekly enable row level security;
alter table public.market_alignment enable row level security;
revoke all on public.holdings_weekly, public.alignment_weekly, public.market_alignment from anon;
revoke all on public.holdings_weekly, public.alignment_weekly, public.market_alignment from authenticated;
grant select on public.holdings_weekly, public.alignment_weekly, public.market_alignment to authenticated;

drop policy if exists "holdings_weekly: read own"  on public.holdings_weekly;
drop policy if exists "alignment_weekly: read own" on public.alignment_weekly;
drop policy if exists "market_alignment: signed-in read" on public.market_alignment;
create policy "holdings_weekly: read own"  on public.holdings_weekly  for select to authenticated using (user_id = (select auth.uid()));
create policy "alignment_weekly: read own" on public.alignment_weekly for select to authenticated using (user_id = (select auth.uid()));
create policy "market_alignment: signed-in read" on public.market_alignment for select to authenticated using (true);
