-- Global switch: when false, the public Meny app and live menu data are hidden.

alter table public.organization_settings
  add column if not exists public_menu_enabled boolean not null default true;

comment on column public.organization_settings.public_menu_enabled is
  'When false, the public Meny application is hidden and live menu rows are not readable by anon/non-admin clients.';

create or replace function public.is_public_menu_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.public_menu_enabled from public.organization_settings s where s.id = true),
    true
  );
$$;

revoke all on function public.is_public_menu_enabled() from public;
grant execute on function public.is_public_menu_enabled() to anon, authenticated;

comment on function public.is_public_menu_enabled() is
  'Returns organization_settings.public_menu_enabled (default true).';

-- Tighten public menu read policies to respect the org switch.
drop policy if exists "Anyone can select live menus" on public.menus;
create policy "Anyone can select live menus"
  on public.menus
  for select
  to anon, authenticated
  using (is_live = true and public.is_public_menu_enabled());

drop policy if exists "Anyone can select live menu_categories" on public.menu_categories;
create policy "Anyone can select live menu_categories"
  on public.menu_categories
  for select
  to anon, authenticated
  using (
    public.is_public_menu_enabled()
    and exists (
      select 1
      from public.menus m
      where m.id = menu_categories.menu_id
        and m.is_live = true
    )
  );

drop policy if exists "Anyone can select live menu_items" on public.menu_items;
create policy "Anyone can select live menu_items"
  on public.menu_items
  for select
  to anon, authenticated
  using (
    public.is_public_menu_enabled()
    and exists (
      select 1
      from public.menu_categories c
      join public.menus m on m.id = c.menu_id
      where c.id = menu_items.category_id
        and m.is_live = true
    )
  );

drop policy if exists "Anyone can select live menu_catalog_items" on public.menu_catalog_items;
create policy "Anyone can select live menu_catalog_items"
  on public.menu_catalog_items
  for select
  to anon, authenticated
  using (
    public.is_public_menu_enabled()
    and exists (
      select 1
      from public.menu_items mi
      join public.menu_categories c on c.id = mi.category_id
      join public.menus m on m.id = c.menu_id
      where mi.catalog_item_id = menu_catalog_items.id
        and m.is_live = true
    )
  );
