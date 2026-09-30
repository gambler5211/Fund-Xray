-- Week 3, Day 2: how spread out each portfolio really is.
--
-- portfolio_concentration  one row per user, rewritten by jobs/compute_concentration.py after the
--                          nightly prices: effective holdings, effective bets, the clusters of
--                          holdings that move together, and the holdings left out for lack of history.
-- Written only by the job (secret key); you read your own row. Deleting your account removes it.

create table if not exists public.portfolio_concentration (
  user_id             uuid primary key references public.users (id) on delete cascade,
  computed_at         timestamptz not null default now(),
  snapshot_at         timestamptz not null,       -- the holdings snapshot it used
  prices_to           date,                       -- the last price date in the window
  holdings            int not null,
  effective_holdings  numeric not null,
  effective_bets      numeric not null,
  clusters            jsonb not null default '[]'::jsonb,  -- [{symbols, names, share, correlation}]
  left_out            jsonb not null default '[]'::jsonb,  -- [{symbol, name, share}]
  weeks               int not null,
  cut                 numeric not null            -- the correlation cut-off used
);

alter table public.portfolio_concentration enable row level security;
revoke all on public.portfolio_concentration from anon;
revoke all on public.portfolio_concentration from authenticated;
grant select on public.portfolio_concentration to authenticated;

drop policy if exists "portfolio_concentration: read own" on public.portfolio_concentration;
create policy "portfolio_concentration: read own" on public.portfolio_concentration
  for select to authenticated using (user_id = (select auth.uid()));
