-- Papirkurv easter egg: admin-curated junk that visitors can browse.

create table public.recycle_bin_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint recycle_bin_items_name_not_blank check (length(trim(name)) > 0)
);

create index recycle_bin_items_sort_idx
  on public.recycle_bin_items (sort_order, created_at);

comment on table public.recycle_bin_items is
  'Admin-curated Papirkurv easter egg items shown on the public desktop.';
comment on column public.recycle_bin_items.description is
  'Optional short joke or flavor text under the item name.';

alter table public.recycle_bin_items enable row level security;

-- Public read for everyone (no profiles subquery — avoids RLS recursion when logged in).
create policy "Anyone can select recycle_bin_items"
  on public.recycle_bin_items
  for select
  to anon, authenticated
  using (true);

-- Admin writes via SECURITY DEFINER helper (safe under profiles RLS).
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

grant select, insert, update, delete on public.recycle_bin_items to authenticated;
grant select on public.recycle_bin_items to anon;
