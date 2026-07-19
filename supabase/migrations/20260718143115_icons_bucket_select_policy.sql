-- storage.buckets has RLS enabled with no default SELECT policies.
-- Without this, anon/authenticated get "Bucket not found" on upload/download
-- even when the bucket row exists (service_role bypasses RLS).

create policy "Anyone can view public buckets"
  on storage.buckets
  for select
  to anon, authenticated
  using (public = true);
