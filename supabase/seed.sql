-- Deterministic fixtures for local `supabase db reset` / test:db / E2E.
-- Day-to-day app development still uses the remote Godebonner project.
--
-- Test users (password for both: password123)
--   admin@test.local     → profiles.is_admin = true
--   member@test.local    → non-admin authenticated user

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Auth users + identities
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'authenticated',
    'authenticated',
    'admin@test.local',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'authenticated',
    'authenticated',
    'member@test.local',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    jsonb_build_object(
      'sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'email', 'admin@test.local'
    ),
    'email',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now(),
    now(),
    now()
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    jsonb_build_object(
      'sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'email', 'member@test.local'
    ),
    'email',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    now(),
    now(),
    now()
  )
on conflict (id) do nothing;

update public.profiles
set is_admin = true
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ---------------------------------------------------------------------------
-- Members (paid insert allocates coupons via trigger; then mark one used)
-- ---------------------------------------------------------------------------
insert into public.members (
  id,
  first_name,
  last_name,
  phone,
  paid
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'Paid',
    'Member',
    '91234567',
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Unpaid',
    'Member',
    '90000000',
    false
  )
on conflict (id) do nothing;

-- Mark the newest unused coupon as used so remaining is typically 2 (of 3)
update public.member_coupons
set used_at = '2026-02-01T12:00:00Z'
where id = (
  select c.id
  from public.member_coupons c
  where c.member_id = '11111111-1111-1111-1111-111111111111'
    and c.used_at is null
  order by c.allocated_at desc, c.id desc
  limit 1
);

-- ---------------------------------------------------------------------------
-- Live menu for public Meny window / E2E
-- ---------------------------------------------------------------------------
insert into public.menu_groups (id, name, sort_order)
values ('a1111111-1111-1111-1111-111111111111', 'Test group', 0)
on conflict (id) do nothing;

insert into public.menus (id, name, group_id, is_live)
values (
  'a2222222-2222-2222-2222-222222222222',
  'Test meny',
  'a1111111-1111-1111-1111-111111111111',
  true
)
on conflict (id) do nothing;

insert into public.menu_categories (id, menu_id, name, sort_order)
values (
  'a3333333-3333-3333-3333-333333333333',
  'a2222222-2222-2222-2222-222222222222',
  'Kaffe',
  0
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Recycle bin (public read / admin write RLS)
-- ---------------------------------------------------------------------------
insert into public.recycle_bin_items (id, name, description, sort_order)
values (
  'a4444444-4444-4444-4444-444444444444',
  'Test papirkurv',
  'Seed item',
  0
)
on conflict (id) do nothing;

-- organization_settings row is inserted by migration (id = true)
