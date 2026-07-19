-- Public icons bucket for custom uploaded Win95-style icons.
-- Public read (menus / papirkurv are public); admin-only write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'icons',
  'icons',
  true,
  2097152, -- 2 MiB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read
create policy "Anyone can read icons"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'icons');

-- Admin write
create policy "Admins can upload icons"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'icons'
    and public.is_current_user_admin()
  );

create policy "Admins can update icons"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'icons'
    and public.is_current_user_admin()
  )
  with check (
    bucket_id = 'icons'
    and public.is_current_user_admin()
  );

create policy "Admins can delete icons"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'icons'
    and public.is_current_user_admin()
  );
