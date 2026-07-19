-- PostgREST rejects unqualified DELETEs in some paths; always filter.

create or replace function public.admin_clear_member_payment_change_log()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if not public.is_current_user_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  delete from public.member_payment_change_log
  where created_at >= '1970-01-01'::timestamptz;
  get diagnostics deleted_count = row_count;

  return jsonb_build_object(
    'status', 'ok',
    'deleted_count', deleted_count
  );
end;
$$;
