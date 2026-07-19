-- Singleton organization settings (coupons per year, display name, etc.)
-- and wire coupon allocation / validation to coupons_per_year.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.organization_settings (
  id boolean primary key default true check (id),
  display_name text not null default 'Gode Bønner',
  coupons_per_year integer not null default 3
    constraint organization_settings_coupons_per_year_range
      check (coupons_per_year >= 1 and coupons_per_year <= 24),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.organization_settings is
  'Singleton row of café/club global settings. Always exactly one row (id = true).';

comment on column public.organization_settings.coupons_per_year is
  'Unused coupon slots allocated to each paid member on join / yearly refresh.';

insert into public.organization_settings (id, display_name, coupons_per_year)
values (true, 'Gode Bønner', 3)
on conflict (id) do nothing;

alter table public.organization_settings enable row level security;

create policy "Anyone can read organization_settings"
  on public.organization_settings
  for select
  to anon, authenticated
  using (true);

create policy "Admins can update organization_settings"
  on public.organization_settings
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

grant select on public.organization_settings to anon, authenticated;
grant update on public.organization_settings to authenticated;

create or replace function public.organization_settings_before_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.id := true;
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.display_name := nullif(trim(new.display_name), '');
  if new.display_name is null then
    raise exception 'display_name cannot be empty';
  end if;
  return new;
end;
$$;

drop trigger if exists organization_settings_before_update on public.organization_settings;
create trigger organization_settings_before_update
  before update on public.organization_settings
  for each row
  execute function public.organization_settings_before_update();

-- ---------------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------------
create or replace function public.organization_coupons_per_year()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.coupons_per_year from public.organization_settings s where s.id = true),
    3
  );
$$;

revoke all on function public.organization_coupons_per_year() from public;
grant execute on function public.organization_coupons_per_year() to anon, authenticated;

comment on function public.organization_coupons_per_year() is
  'Returns coupons_per_year from the singleton organization_settings row (default 3).';

-- ---------------------------------------------------------------------------
-- Relax members.coupons_remaining check (was hard-capped at 3)
-- ---------------------------------------------------------------------------
alter table public.members
  drop constraint if exists members_coupons_remaining_range;

alter table public.members
  add constraint members_coupons_remaining_range
  check (coupons_remaining >= 0 and coupons_remaining <= 24);

-- ---------------------------------------------------------------------------
-- Sync / allocate / paid-change / yearly refresh use setting
-- ---------------------------------------------------------------------------
create or replace function public.sync_member_coupons_remaining(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
  v_paid boolean;
begin
  select m.paid into v_paid from public.members m where m.id = p_member_id;
  if not found then
    return;
  end if;

  select count(*)::integer
    into v_remaining
  from public.member_coupons c
  where c.member_id = p_member_id
    and c.used_at is null;

  if not v_paid then
    v_remaining := 0;
  end if;

  -- Cap at check-constraint max (24); actual unused count may exceed
  -- coupons_per_year briefly after that setting is lowered.
  update public.members
  set coupons_remaining = least(greatest(v_remaining, 0), 24)
  where id = p_member_id;
end;
$$;

create or replace function public.members_before_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.phone := public.normalize_member_phone(new.phone);

  if new.phone is not null and length(new.phone) < 8 then
    raise exception 'Invalid phone number';
  end if;

  if new.email is not null then
    new.email := nullif(lower(trim(new.email)), '');
  end if;

  if not new.paid then
    new.coupons_remaining := 0;
  else
    if new.coupons_remaining < 0 or new.coupons_remaining > 24 then
      raise exception 'coupons_remaining must be between 0 and 24';
    end if;
  end if;

  if new.joined_at is null then
    new.joined_at := coalesce(
      (new.created_at at time zone 'utc')::date,
      current_date
    );
  end if;

  return new;
end;
$$;

create or replace function public.members_after_paid_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unused integer;
  v_count integer;
begin
  v_count := public.organization_coupons_per_year();

  if tg_op = 'UPDATE' and old.paid is distinct from new.paid then
    if not new.paid then
      perform public.clear_unused_member_coupons(new.id);
    else
      select count(*)::integer into v_unused
      from public.member_coupons
      where member_id = new.id
        and used_at is null;

      if v_unused = 0 then
        perform public.allocate_member_coupons(new.id, v_count);
      else
        perform public.sync_member_coupons_remaining(new.id);
      end if;
    end if;
  elsif tg_op = 'INSERT' and new.paid then
    select count(*)::integer into v_unused
    from public.member_coupons
    where member_id = new.id
      and used_at is null;

    if v_unused = 0 then
      perform public.allocate_member_coupons(new.id, v_count);
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.admin_refresh_yearly_coupons()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  r record;
  v_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if not public.is_current_user_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  v_count := public.organization_coupons_per_year();

  for r in select id from public.members where paid = true loop
    perform public.clear_unused_member_coupons(r.id);
    perform public.allocate_member_coupons(r.id, v_count);
    n := n + 1;
  end loop;

  return jsonb_build_object(
    'status', 'ok',
    'updated_count', n,
    'coupons_per_year', v_count
  );
end;
$$;

comment on function public.admin_refresh_yearly_coupons() is
  'Clears unused coupon slots and allocates organization_settings.coupons_per_year fresh unused slots for all paid members; admin only.';
