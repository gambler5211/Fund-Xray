-- Day 7: a log of the scheduled data jobs, so the app can say how fresh its data is.
--
-- The GitHub Actions jobs write here with the Supabase secret key (which bypasses row-level
-- security). Signed-in users can read it: it holds job names, times and counts, nothing personal.

create table if not exists public.job_runs (
  id           bigint generated always as identity primary key,
  job          text not null,                          -- 'nightly', 'sectors', 'backfill'
  started_at   timestamptz not null,
  finished_at  timestamptz not null default now(),
  status       text not null check (status in ('ok', 'failed')),
  summary      text,                                   -- one plain line, e.g. 'Added 1 trading day (30 Sep)'
  details      jsonb not null default '{}'::jsonb
);
create index if not exists job_runs_job_started on public.job_runs (job, started_at desc);

alter table public.job_runs enable row level security;
revoke all on public.job_runs from anon;
revoke all on public.job_runs from authenticated;
grant select on public.job_runs to authenticated;

drop policy if exists "job_runs: signed-in read" on public.job_runs;
create policy "job_runs: signed-in read" on public.job_runs for select to authenticated using (true);
