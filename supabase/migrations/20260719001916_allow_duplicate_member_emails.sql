-- Allow multiple members to share an email. Identity key is external_id (and PK).

drop index if exists public.members_email_unique;

create index if not exists members_email_idx
  on public.members (lower(email))
  where email is not null and length(trim(email)) > 0;

comment on column public.members.email is
  'Email (Epost). Not unique — several members may share an address.';
