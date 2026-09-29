-- Day 4: functions the API uses to save, read and remove your Kite connection.
--
-- The API calls these with *your* sign-in token, so auth.uid() is you and nothing here can touch
-- another user's row. That means the API needs no Supabase secret key. The token itself arrives
-- already encrypted (Fernet); the key lives only on Cloud Run, so the database never sees it in
-- the clear.

create or replace function public.save_kite_token(p_enc text, p_kite_user_id text, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.kite_tokens (user_id, kite_user_id, access_token_enc, expires_at, updated_at)
  values (auth.uid(), p_kite_user_id, p_enc, p_expires_at, now())
  on conflict (user_id) do update
    set kite_user_id = excluded.kite_user_id,
        access_token_enc = excluded.access_token_enc,
        expires_at = excluded.expires_at,
        updated_at = now();
end $$;

create or replace function public.get_kite_token()
returns table (access_token_enc text, kite_user_id text, expires_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select k.access_token_enc, k.kite_user_id, k.expires_at, k.updated_at
  from public.kite_tokens k
  where k.user_id = auth.uid();
$$;

create or replace function public.delete_kite_token()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.kite_tokens where user_id = auth.uid();
end $$;

revoke all on function public.save_kite_token(text, text, timestamptz) from public, anon;
revoke all on function public.get_kite_token() from public, anon;
revoke all on function public.delete_kite_token() from public, anon;
grant execute on function public.save_kite_token(text, text, timestamptz) to authenticated;
grant execute on function public.get_kite_token() to authenticated;
grant execute on function public.delete_kite_token() to authenticated;
