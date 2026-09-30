-- Week 2, Day 4: steady quadrant labels, breadth per index per week, and the market regime.
--
-- Shared reference data like rotation_scores: signed-in users read, only the GitHub Actions jobs
-- (Supabase secret key) write. After this is applied, run NSE data → `breadth` once to fill it.

-- The steady label: an index keeps its side of each line until it crosses by more than half a
-- point (engine: rotation.NEUTRAL_BAND). Filled by compute_rotation.py --full, which `breadth` runs.
alter table public.rotation_scores
  add column if not exists settled_quadrant text
  check (settled_quadrant in ('Leading', 'Weakening', 'Lagging', 'Improving'));

-- One row per index per week (week_start = that week's Monday; date = its last trading day so far).
-- Returns are over 20 trading days; spread = index return - equal-weight return, in points.
create table if not exists public.index_breadth (
  index_key       text not null references public.tracked_indices (key) on delete cascade,
  week_start      date not null,
  date            date not null,
  members         integer not null,
  pct_above_avg   numeric not null,
  pct_up          numeric not null,
  ew_return       numeric not null,
  index_return    numeric,
  spread          numeric,
  narrow          boolean not null default false,
  primary key (index_key, week_start)
);
create index if not exists index_breadth_week on public.index_breadth (week_start);

-- One row per week. Ratios are against the Nifty 500; market_breadth is the Nifty 500's
-- pct_above_avg. threshold and breadth_min record the rule the label was computed with.
create table if not exists public.market_regime (
  week_start      date primary key,
  date            date not null,
  cyclical        numeric not null,
  defensive       numeric not null,
  spread          numeric not null,
  market_breadth  numeric,
  regime          text not null check (regime in ('Cyclical lead', 'Defensive lead', 'Neutral')),
  threshold       numeric not null,
  breadth_min     numeric not null
);

alter table public.index_breadth enable row level security;
alter table public.market_regime enable row level security;
revoke all on public.index_breadth, public.market_regime from anon;
revoke all on public.index_breadth, public.market_regime from authenticated;
grant select on public.index_breadth, public.market_regime to authenticated;

drop policy if exists "index_breadth: signed-in read" on public.index_breadth;
drop policy if exists "market_regime: signed-in read" on public.market_regime;
create policy "index_breadth: signed-in read" on public.index_breadth for select to authenticated using (true);
create policy "market_regime: signed-in read" on public.market_regime for select to authenticated using (true);
