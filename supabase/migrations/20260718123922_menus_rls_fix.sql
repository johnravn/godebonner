-- Fix menus RLS: admin policies that subquery profiles recurse with
-- "Admins can read all profiles". Use is_current_user_admin() instead.
-- Also update admin_set_menu_live to use the same helper.

-- ---------------------------------------------------------------------------
-- menus
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can select menus" on public.menus;
drop policy if exists "Admins can insert menus" on public.menus;
drop policy if exists "Admins can update menus" on public.menus;
drop policy if exists "Admins can delete menus" on public.menus;

create policy "Admins can select menus"
  on public.menus
  for select
  to authenticated
  using (public.is_current_user_admin());

create policy "Admins can insert menus"
  on public.menus
  for insert
  to authenticated
  with check (public.is_current_user_admin());

create policy "Admins can update menus"
  on public.menus
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "Admins can delete menus"
  on public.menus
  for delete
  to authenticated
  using (public.is_current_user_admin());

-- ---------------------------------------------------------------------------
-- menu_categories
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can select menu_categories" on public.menu_categories;
drop policy if exists "Admins can insert menu_categories" on public.menu_categories;
drop policy if exists "Admins can update menu_categories" on public.menu_categories;
drop policy if exists "Admins can delete menu_categories" on public.menu_categories;

create policy "Admins can select menu_categories"
  on public.menu_categories
  for select
  to authenticated
  using (public.is_current_user_admin());

create policy "Admins can insert menu_categories"
  on public.menu_categories
  for insert
  to authenticated
  with check (public.is_current_user_admin());

create policy "Admins can update menu_categories"
  on public.menu_categories
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "Admins can delete menu_categories"
  on public.menu_categories
  for delete
  to authenticated
  using (public.is_current_user_admin());

-- ---------------------------------------------------------------------------
-- menu_items
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can select menu_items" on public.menu_items;
drop policy if exists "Admins can insert menu_items" on public.menu_items;
drop policy if exists "Admins can update menu_items" on public.menu_items;
drop policy if exists "Admins can delete menu_items" on public.menu_items;

create policy "Admins can select menu_items"
  on public.menu_items
  for select
  to authenticated
  using (public.is_current_user_admin());

create policy "Admins can insert menu_items"
  on public.menu_items
  for insert
  to authenticated
  with check (public.is_current_user_admin());

create policy "Admins can update menu_items"
  on public.menu_items
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "Admins can delete menu_items"
  on public.menu_items
  for delete
  to authenticated
  using (public.is_current_user_admin());

-- ---------------------------------------------------------------------------
-- admin_set_menu_live
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_menu_live(p_menu_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if not public.is_current_user_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if not exists (select 1 from public.menus m where m.id = p_menu_id) then
    return jsonb_build_object('status', 'not_found');
  end if;

  update public.menus set is_live = false where is_live = true;
  update public.menus set is_live = true where id = p_menu_id;

  return jsonb_build_object('status', 'ok', 'menu_id', p_menu_id);
end;
$$;
