-- Café menus: named menus with categories (folders) and items.
-- At most one menu can be live at a time (partial unique index).
-- Public clients may SELECT only the live menu and its categories/items.

-- ---------------------------------------------------------------------------
-- menus
-- ---------------------------------------------------------------------------
create table public.menus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  constraint menus_name_not_blank check (length(trim(name)) > 0)
);

create unique index menus_one_live on public.menus (is_live) where is_live = true;

comment on table public.menus is
  'Named café menus. At most one row may have is_live = true.';
comment on column public.menus.is_live is
  'When true, this menu is visible to the public. Enforced unique via menus_one_live.';

-- ---------------------------------------------------------------------------
-- menu_categories
-- ---------------------------------------------------------------------------
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint menu_categories_name_not_blank check (length(trim(name)) > 0)
);

create index menu_categories_menu_id_sort_idx
  on public.menu_categories (menu_id, sort_order);

comment on table public.menu_categories is
  'Admin-defined category folders within a menu.';

-- ---------------------------------------------------------------------------
-- menu_items
-- ---------------------------------------------------------------------------
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories (id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null,
  is_sold_out boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint menu_items_name_not_blank check (length(trim(name)) > 0),
  constraint menu_items_price_non_negative check (price >= 0)
);

create index menu_items_category_id_sort_idx
  on public.menu_items (category_id, sort_order);

comment on table public.menu_items is
  'Menu items belonging to a category. is_sold_out marks temporary unavailability.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.menus enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;

-- menus: admin CRUD
create policy "Admins can select menus"
  on public.menus
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  );

create policy "Admins can insert menus"
  on public.menus
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  );

create policy "Admins can update menus"
  on public.menus
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  );

create policy "Admins can delete menus"
  on public.menus
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  );

-- menus: public may read the live menu
create policy "Anyone can select live menus"
  on public.menus
  for select
  to anon, authenticated
  using (is_live = true);

-- menu_categories: admin CRUD
create policy "Admins can select menu_categories"
  on public.menu_categories
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  );

create policy "Admins can insert menu_categories"
  on public.menu_categories
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  );

create policy "Admins can update menu_categories"
  on public.menu_categories
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  );

create policy "Admins can delete menu_categories"
  on public.menu_categories
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  );

-- menu_categories: public may read categories of the live menu
create policy "Anyone can select live menu_categories"
  on public.menu_categories
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.menus m
      where m.id = menu_categories.menu_id
        and m.is_live = true
    )
  );

-- menu_items: admin CRUD
create policy "Admins can select menu_items"
  on public.menu_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  );

create policy "Admins can insert menu_items"
  on public.menu_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  );

create policy "Admins can update menu_items"
  on public.menu_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  );

create policy "Admins can delete menu_items"
  on public.menu_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.is_admin = true
    )
  );

-- menu_items: public may read items of the live menu
create policy "Anyone can select live menu_items"
  on public.menu_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.menu_categories c
      join public.menus m on m.id = c.menu_id
      where c.id = menu_items.category_id
        and m.is_live = true
    )
  );

grant select, insert, update, delete on public.menus to authenticated;
grant select on public.menus to anon;

grant select, insert, update, delete on public.menu_categories to authenticated;
grant select on public.menu_categories to anon;

grant select, insert, update, delete on public.menu_items to authenticated;
grant select on public.menu_items to anon;

-- ---------------------------------------------------------------------------
-- Admin: set exactly one menu live (atomic)
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

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  ) then
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

revoke all on function public.admin_set_menu_live(uuid) from public;
grant execute on function public.admin_set_menu_live(uuid) to authenticated;

comment on function public.admin_set_menu_live(uuid) is
  'Marks the given menu as the sole live menu; admin only.';
