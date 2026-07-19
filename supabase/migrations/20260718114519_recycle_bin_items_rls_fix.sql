-- Fix recycle_bin_items RLS: admin policies that subquery profiles recurse
-- with "Admins can read all profiles". Use is_current_user_admin() instead.
-- Public SELECT already covers authenticated readers, so drop admin SELECT.

drop policy if exists "Admins can select recycle_bin_items" on public.recycle_bin_items;
drop policy if exists "Admins can insert recycle_bin_items" on public.recycle_bin_items;
drop policy if exists "Admins can update recycle_bin_items" on public.recycle_bin_items;
drop policy if exists "Admins can delete recycle_bin_items" on public.recycle_bin_items;

create policy "Admins can insert recycle_bin_items"
  on public.recycle_bin_items
  for insert
  to authenticated
  with check (public.is_current_user_admin());

create policy "Admins can update recycle_bin_items"
  on public.recycle_bin_items
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "Admins can delete recycle_bin_items"
  on public.recycle_bin_items
  for delete
  to authenticated
  using (public.is_current_user_admin());
