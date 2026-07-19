-- Allow admins to clear the payment change log (dev / reset).

create policy "Admins can delete member_payment_change_log"
  on public.member_payment_change_log
  for delete
  to authenticated
  using (public.is_current_user_admin());

grant delete on public.member_payment_change_log to authenticated;

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

  delete from public.member_payment_change_log;
  get diagnostics deleted_count = row_count;

  return jsonb_build_object(
    'status', 'ok',
    'deleted_count', deleted_count
  );
end;
$$;

revoke all on function public.admin_clear_member_payment_change_log() from public;
grant execute on function public.admin_clear_member_payment_change_log() to authenticated;

comment on function public.admin_clear_member_payment_change_log() is
  'Deletes all payment change log rows; admin only (dev reset).';
