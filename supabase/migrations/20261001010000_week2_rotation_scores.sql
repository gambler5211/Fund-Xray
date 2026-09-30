-- Week 2, Day 2: rotation scores, the sector-to-index map, and seven more NSE sector indices.
--
-- Like index_prices, these are shared reference data: signed-in users read them, and only the
-- GitHub Actions jobs (Supabase secret key, which bypasses row-level security) write them.

-- Seven sector indices NSE publishes that match sectors held in the app. Several are new:
-- NSE's daily file has Capital Markets from about Jan 2025, Chemicals from mid-2025, and
-- Power, Capital Goods, Telecommunications and Consumer Services only from about July 2026,
-- so those four have a short history until more weeks pass.
insert into public.tracked_indices (key, nse_name, label, kind, sort) values
  ('nifty-capital-goods',     'Nifty Capital Goods',      'Capital Goods',     'sector', 24),
  ('nifty-power',             'Nifty Power',              'Power',             'sector', 25),
  ('nifty-chemicals',         'Nifty Chemicals',          'Chemicals',         'sector', 26),
  ('nifty-services',          'Nifty Services Sector',    'Services',          'sector', 27),
  ('nifty-telecom',           'Nifty Telecommunications', 'Telecom',           'sector', 28),
  ('nifty-consumer-services', 'Nifty Consumer Services',  'Consumer Services', 'sector', 29),
  ('nifty-capital-markets',   'Nifty Capital Markets',    'Capital Markets',   'sector', 36)
on conflict (key) do update set nse_name = excluded.nse_name, label = excluded.label, kind = excluded.kind, sort = excluded.sort;

-- One row per index, benchmark and trading day. week_end marks the last trading day of each
-- week, which is what the Rotation chart plots.
create table if not exists public.rotation_scores (
  index_key      text not null references public.tracked_indices (key) on delete cascade,
  benchmark_key  text not null references public.tracked_indices (key) on delete cascade,
  date           date not null,
  rs             numeric not null,
  ratio          numeric not null,
  momentum       numeric not null,
  quadrant       text not null check (quadrant in ('Leading', 'Weakening', 'Lagging', 'Improving')),
  week_end       boolean not null default false,
  primary key (index_key, benchmark_key, date),
  check (index_key <> benchmark_key)
);
create index if not exists rotation_scores_weekly on public.rotation_scores (benchmark_key, date) where week_end;

-- Each NSE sector (the level holdings are classified at) to its closest index. fit = 'direct'
-- when the index is that sector, 'proxy' when it only overlaps. Sectors without a sensible index
-- (Diversified, Textiles, ...) are left out on purpose rather than borrowing one.
create table if not exists public.sector_index_map (
  industry   text primary key,
  index_key  text not null references public.tracked_indices (key) on delete cascade,
  fit        text not null default 'direct' check (fit in ('direct', 'proxy'))
);

insert into public.sector_index_map (industry, index_key, fit) values
  ('Automobile and Auto Components',    'nifty-auto',              'direct'),
  ('Capital Goods',                     'nifty-capital-goods',     'direct'),
  ('Chemicals',                         'nifty-chemicals',         'direct'),
  ('Construction',                      'nifty-infra',             'proxy'),
  ('Consumer Durables',                 'nifty-cons-durables',     'direct'),
  ('Consumer Services',                 'nifty-consumer-services', 'direct'),
  ('Fast Moving Consumer Goods',        'nifty-fmcg',              'direct'),
  ('Financial Services',                'nifty-fin-services',      'direct'),
  ('Healthcare',                        'nifty-healthcare',        'direct'),
  ('Information Technology',            'nifty-it',                'direct'),
  ('Media Entertainment & Publication', 'nifty-media',             'direct'),
  ('Metals & Mining',                   'nifty-metal',             'direct'),
  ('Oil Gas & Consumable Fuels',        'nifty-oil-gas',           'direct'),
  ('Power',                             'nifty-power',             'direct'),
  ('Realty',                            'nifty-realty',            'direct'),
  ('Services',                          'nifty-services',          'direct'),
  ('Telecommunication',                 'nifty-telecom',           'direct')
on conflict (industry) do update set index_key = excluded.index_key, fit = excluded.fit;

alter table public.rotation_scores  enable row level security;
alter table public.sector_index_map enable row level security;
revoke all on public.rotation_scores, public.sector_index_map from anon;
revoke all on public.rotation_scores, public.sector_index_map from authenticated;
grant select on public.rotation_scores, public.sector_index_map to authenticated;

drop policy if exists "rotation_scores: signed-in read"  on public.rotation_scores;
drop policy if exists "sector_index_map: signed-in read" on public.sector_index_map;
create policy "rotation_scores: signed-in read"  on public.rotation_scores  for select to authenticated using (true);
create policy "sector_index_map: signed-in read" on public.sector_index_map for select to authenticated using (true);
