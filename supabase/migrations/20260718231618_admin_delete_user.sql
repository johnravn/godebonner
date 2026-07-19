-- Allow admins to permanently delete auth users (cascade removes profiles).

create or replace function public.admin_delete_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.profiles%rowtype;
  admin_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if not public.is_current_user_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if p_user_id = auth.uid() then
    return jsonb_build_object('status', 'cannot_delete_self');
  end if;

  select * into target from public.profiles where id = p_user_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if target.is_admin then
    select count(*)::integer into admin_count
    from public.profiles
    where is_admin = true;

    if admin_count <= 1 then
      return jsonb_build_object('status', 'last_admin');
    end if;
  end if;

  delete from auth.users where id = p_user_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

comment on function public.admin_delete_user(uuid) is
  'Permanently deletes an auth user (and cascaded profile); admin only. Cannot delete self or the last admin.';
