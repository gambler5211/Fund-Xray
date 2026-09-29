# Supabase migrations

Run each file in `migrations/` once, in order, in Supabase → SQL Editor (or with `supabase db push`).

- `20260930000000_day3_users_settings.sql`: users, settings, kite_tokens, holdings_snapshot with
  row-level security; creates your settings row on first sign-in; `delete_my_account()`.
