-- Registry of uploaded custom icons so admins can reuse them later.

create table public.custom_icons (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  name text not null default '',
  pixelated boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint custom_icons_storage_path_nonempty check (length(trim(storage_path)) > 0),
  constraint custom_icons_storage_path_unique unique (storage_path)
);

comment on table public.custom_icons is
  'Admin-uploaded custom icons (storage paths) for reuse in icon pickers.';

comment on column public.custom_icons.storage_path is
  'Path inside the icons storage bucket (without custom: prefix).';

create index custom_icons_created_at_idx on public.custom_icons (created_at desc);

alter table public.custom_icons enable row level security;

create policy "Admins can select custom_icons"
  on public.custom_icons
  for select
  to authenticated
  using (public.is_current_user_admin());

create policy "Admins can insert custom_icons"
  on public.custom_icons
  for insert
  to authenticated
  with check (public.is_current_user_admin());

create policy "Admins can update custom_icons"
  on public.custom_icons
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "Admins can delete custom_icons"
  on public.custom_icons
  for delete
  to authenticated
  using (public.is_current_user_admin());
