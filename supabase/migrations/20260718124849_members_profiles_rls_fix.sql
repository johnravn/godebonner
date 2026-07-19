-- Fix RLS recursion: members (and profiles admin) policies that subquery
-- profiles recurse with "Admins can read all profiles". Use
-- is_current_user_admin() (SECURITY DEFINER) instead — same fix as menus /
-- recycle_bin.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;

create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_current_user_admin());

create policy "Admins can update profiles"
  on public.profiles
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can select members" on public.members;
drop policy if exists "Admins can insert members" on public.members;
drop policy if exists "Admins can update members" on public.members;
drop policy if exists "Admins can delete members" on public.members;

create policy "Admins can select members"
  on public.members
  for select
  to authenticated
  using (public.is_current_user_admin());

create policy "Admins can insert members"
  on public.members
  for insert
  to authenticated
  with check (public.is_current_user_admin());

create policy "Admins can update members"
  on public.members
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "Admins can delete members"
  on public.members
  for delete
  to authenticated
  using (public.is_current_user_admin());
