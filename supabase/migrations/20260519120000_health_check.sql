-- Lightweight read-only check for admin status page (PostgREST RPC).
-- Runs with definer rights but returns only a constant (no user input).
create or replace function public.health_check()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('ok', true);
$$;

revoke all on function public.health_check() from public;
grant execute on function public.health_check() to authenticated;

comment on function public.health_check() is
  'Returns {"ok":true} if PostgREST/DB is reachable; used by admin system status.';
