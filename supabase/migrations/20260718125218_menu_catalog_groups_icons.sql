-- Menu catalog (item bank), menu groups, icons, and copy-menu RPC.
-- Migrates menu_items from embedded name/description to catalog placements.

-- ---------------------------------------------------------------------------
-- menu_groups
-- ---------------------------------------------------------------------------
create table public.menu_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default 'Folder',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint menu_groups_name_not_blank check (length(trim(name)) > 0),
  constraint menu_groups_icon_not_blank check (length(trim(icon)) > 0)
);

create index menu_groups_sort_idx on public.menu_groups (sort_order, name);

comment on table public.menu_groups is
  'Named groups that contain menus (e.g. Summercamp). Admin-only.';

-- ---------------------------------------------------------------------------
-- menu_catalog_items (item bank)
-- ---------------------------------------------------------------------------
create table public.menu_catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  default_price numeric(10, 2) not null,
  icon text not null default 'FileText',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint menu_catalog_items_name_not_blank check (length(trim(name)) > 0),
  constraint menu_catalog_items_icon_not_blank check (length(trim(icon)) > 0),
  constraint menu_catalog_items_price_non_negative check (default_price >= 0)
);

create index menu_catalog_items_sort_idx
  on public.menu_catalog_items (sort_order, name);

comment on table public.menu_catalog_items is
  'Reusable menu item bank. Placements reference these and may override price.';

-- ---------------------------------------------------------------------------
-- Alter menus: group_id + icon
-- ---------------------------------------------------------------------------
alter table public.menus
  add column group_id uuid references public.menu_groups (id) on delete set null,
  add column icon text not null default 'Notepad';

alter table public.menus
  add constraint menus_icon_not_blank check (length(trim(icon)) > 0);

create index menus_group_id_idx on public.menus (group_id);

comment on column public.menus.group_id is
  'Optional menu group (null = ungrouped).';
comment on column public.menus.icon is
  'React95 icon id for the menu root.';

-- ---------------------------------------------------------------------------
-- Alter menu_categories: icon
-- ---------------------------------------------------------------------------
alter table public.menu_categories
  add column icon text not null default 'Folder';

alter table public.menu_categories
  add constraint menu_categories_icon_not_blank check (length(trim(icon)) > 0);

comment on column public.menu_categories.icon is
  'React95 icon id for the category folder in the tree.';

-- ---------------------------------------------------------------------------
-- Migrate menu_items → catalog placements
-- ---------------------------------------------------------------------------
alter table public.menu_items
  add column catalog_item_id uuid references public.menu_catalog_items (id);

-- Backfill: one catalog row per existing menu_item (preserves distinct prices)
do $$
declare
  r record;
  v_catalog_id uuid;
begin
  for r in
    select id, name, description, price, sort_order
    from public.menu_items
    order by created_at, id
  loop
    insert into public.menu_catalog_items (name, description, default_price, icon, sort_order)
    values (r.name, r.description, r.price, 'FileText', r.sort_order)
    returning id into v_catalog_id;

    update public.menu_items
    set catalog_item_id = v_catalog_id
    where id = r.id;
  end loop;
end;
$$;

alter table public.menu_items
  alter column catalog_item_id set not null;

alter table public.menu_items
  drop constraint if exists menu_items_name_not_blank;

alter table public.menu_items
  drop column name,
  drop column description;

create index menu_items_catalog_item_id_idx
  on public.menu_items (catalog_item_id);

comment on column public.menu_items.catalog_item_id is
  'Reference to the shared catalog item.';
comment on column public.menu_items.price is
  'Price on this menu placement; may differ from catalog default_price.';

-- ---------------------------------------------------------------------------
-- RLS: menu_groups (admin only)
-- ---------------------------------------------------------------------------
alter table public.menu_groups enable row level security;

create policy "Admins can select menu_groups"
  on public.menu_groups
  for select
  to authenticated
  using (public.is_current_user_admin());

create policy "Admins can insert menu_groups"
  on public.menu_groups
  for insert
  to authenticated
  with check (public.is_current_user_admin());

create policy "Admins can update menu_groups"
  on public.menu_groups
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "Admins can delete menu_groups"
  on public.menu_groups
  for delete
  to authenticated
  using (public.is_current_user_admin());

grant select, insert, update, delete on public.menu_groups to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: menu_catalog_items
-- ---------------------------------------------------------------------------
alter table public.menu_catalog_items enable row level security;

create policy "Admins can select menu_catalog_items"
  on public.menu_catalog_items
  for select
  to authenticated
  using (public.is_current_user_admin());

create policy "Admins can insert menu_catalog_items"
  on public.menu_catalog_items
  for insert
  to authenticated
  with check (public.is_current_user_admin());

create policy "Admins can update menu_catalog_items"
  on public.menu_catalog_items
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "Admins can delete menu_catalog_items"
  on public.menu_catalog_items
  for delete
  to authenticated
  using (public.is_current_user_admin());

-- Public may read catalog items that appear on the live menu
create policy "Anyone can select live menu_catalog_items"
  on public.menu_catalog_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.menu_items mi
      join public.menu_categories c on c.id = mi.category_id
      join public.menus m on m.id = c.menu_id
      where mi.catalog_item_id = menu_catalog_items.id
        and m.is_live = true
    )
  );

grant select, insert, update, delete on public.menu_catalog_items to authenticated;
grant select on public.menu_catalog_items to anon;

-- ---------------------------------------------------------------------------
-- admin_copy_menu
-- ---------------------------------------------------------------------------
create or replace function public.admin_copy_menu(
  p_menu_id uuid,
  p_new_name text default null,
  p_group_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.menus%rowtype;
  v_new_id uuid;
  v_name text;
  v_group_id uuid;
  v_cat record;
  v_new_cat_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if not public.is_current_user_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select * into v_src from public.menus where id = p_menu_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_name := nullif(trim(coalesce(p_new_name, '')), '');
  if v_name is null then
    v_name := v_src.name || ' (kopi)';
  end if;

  -- p_group_id may be null (ungrouped). Callers should pass the desired group explicitly.
  v_group_id := p_group_id;
  if v_group_id is not null
     and not exists (select 1 from public.menu_groups g where g.id = v_group_id) then
    return jsonb_build_object('status', 'invalid_group');
  end if;

  insert into public.menus (name, is_live, group_id, icon)
  values (v_name, false, v_group_id, v_src.icon)
  returning id into v_new_id;

  for v_cat in
    select * from public.menu_categories
    where menu_id = p_menu_id
    order by sort_order, name
  loop
    insert into public.menu_categories (menu_id, name, sort_order, icon)
    values (v_new_id, v_cat.name, v_cat.sort_order, v_cat.icon)
    returning id into v_new_cat_id;

    insert into public.menu_items (
      category_id,
      catalog_item_id,
      price,
      is_sold_out,
      sort_order
    )
    select
      v_new_cat_id,
      mi.catalog_item_id,
      mi.price,
      mi.is_sold_out,
      mi.sort_order
    from public.menu_items mi
    where mi.category_id = v_cat.id
    order by mi.sort_order, mi.created_at;
  end loop;

  return jsonb_build_object('status', 'ok', 'menu_id', v_new_id);
end;
$$;

revoke all on function public.admin_copy_menu(uuid, text, uuid) from public;
grant execute on function public.admin_copy_menu(uuid, text, uuid) to authenticated;

comment on function public.admin_copy_menu(uuid, text, uuid) is
  'Deep-copies a menu with categories and placements; admin only. New menu is not live.';
