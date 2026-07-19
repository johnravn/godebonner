-- Members + free-drink coupons (manual yearly allocation by admins).
--
-- Model:
-- - paid members receive up to 3 coupons per allocation period.
-- - Coupons do NOT auto-reset on a calendar; only admin_refresh_yearly_coupons()
--   sets coupons_remaining = 3 and last_allocation_at = now() for rows where paid = true.
-- - Unpaid members always have coupons_remaining = 0 (enforced in app + update trigger).
-- - Public lookup uses get_coupons_by_phone() (SECURITY DEFINER) so anon clients never
--   SELECT the members table directly.

-- ---------------------------------------------------------------------------
-- Phone normalization (digits only; 8-digit Norwegian mobiles get leading 47)
-- ---------------------------------------------------------------------------
create or replace function public.normalize_member_phone(input text)
returns text
language sql
immutable
set search_path = public
as $$
  with t as (
    select regexp_replace(trim(coalesce(input, '')), '\D', '', 'g') as digits
  )
  select case
    when length(t.digits) = 0 then null
    when length(t.digits) = 8 and left(t.digits, 1) in ('4', '9') then '47' || t.digits
    else t.digits
  end
  from t;
$$;

revoke all on function public.normalize_member_phone(text) from public;
grant execute on function public.normalize_member_phone(text) to authenticated;

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------
create table public.members (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  paid boolean not null default false,
  coupons_remaining integer not null default 0,
  last_allocation_at timestamptz,
  created_at timestamptz not null default now(),
  constraint members_coupons_remaining_range check (
    coupons_remaining >= 0
    and coupons_remaining <= 3
  ),
  constraint members_coupons_paid_consistency check (
    (paid = true) or coupons_remaining = 0
  )
);

create unique index members_phone_unique on public.members (phone);

create or replace function public.members_before_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.phone := public.normalize_member_phone(new.phone);

  if new.phone is null or length(new.phone) < 8 then
    raise exception 'Invalid phone number';
  end if;

  if not new.paid then
    new.coupons_remaining := 0;
  else
    if new.coupons_remaining < 0 or new.coupons_remaining > 3 then
      raise exception 'coupons_remaining must be between 0 and 3';
    end if;

    if tg_op = 'INSERT' and new.coupons_remaining = 0 then
      new.coupons_remaining := 3;
    end if;
  end if;

  return new;
end;
$$;

create trigger members_before_write
  before insert or update on public.members
  for each row
  execute function public.members_before_write();

comment on table public.members is
  'Club members and coupon balance. Yearly refresh is admin-only via admin_refresh_yearly_coupons().';
comment on column public.members.phone is
  'E.164-style digits (normalized). Unique.';
comment on column public.members.last_allocation_at is
  'Timestamp of the last admin yearly coupon allocation affecting this row.';

alter table public.members enable row level security;

create policy "Admins can select members"
  on public.members
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

create policy "Admins can insert members"
  on public.members
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

create policy "Admins can update members"
  on public.members
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

create policy "Admins can delete members"
  on public.members
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

-- ---------------------------------------------------------------------------
-- Public lookup (limited fields; no direct table read for anon)
-- ---------------------------------------------------------------------------
create or replace function public.get_coupons_by_phone(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_phone text;
  r record;
begin
  v_phone := public.normalize_member_phone(p_phone);

  if v_phone is null or length(v_phone) < 8 then
    return jsonb_build_object('status', 'invalid_phone');
  end if;

  select m.paid, m.coupons_remaining, m.first_name
    into r
    from public.members m
    where m.phone = v_phone;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'paid', r.paid,
    'coupons_remaining', r.coupons_remaining,
    'first_name', r.first_name
  );
end;
$$;

revoke all on function public.get_coupons_by_phone(text) from public;
grant execute on function public.get_coupons_by_phone(text) to anon, authenticated;

comment on function public.get_coupons_by_phone(text) is
  'Returns coupon summary for a normalized phone; safe for anonymous clients.';

-- ---------------------------------------------------------------------------
-- Admin yearly refresh (atomic; verifies admin inside definer function)
-- ---------------------------------------------------------------------------
create or replace function public.admin_refresh_yearly_coupons()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
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

  with updated as (
    update public.members
    set
      coupons_remaining = 3,
      last_allocation_at = now()
    where paid = true
    returning 1
  )
  select count(*)::int into n from updated;

  return jsonb_build_object('status', 'ok', 'updated_count', n);
end;
$$;

revoke all on function public.admin_refresh_yearly_coupons() from public;
grant execute on function public.admin_refresh_yearly_coupons() to authenticated;

comment on function public.admin_refresh_yearly_coupons() is
  'Sets coupons_remaining=3 and last_allocation_at=now() for all paid members; admin only.';

grant select, insert, update, delete on public.members to authenticated;
