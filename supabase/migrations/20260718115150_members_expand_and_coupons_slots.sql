-- Expand members to match club sheet fields; replace balance-only coupons
-- with per-slot rows that record use timestamps.
--
-- coupons_remaining stays as a denormalized count of unused slots (synced by
-- triggers) so public get_coupons_by_phone and existing admin UI keep working.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- members: extra profile columns
-- ---------------------------------------------------------------------------
alter table public.members
  add column if not exists address text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists email text,
  add column if not exists birth_year integer,
  add column if not exists member_type text,
  add column if not exists joined_at date;

update public.members
set joined_at = (created_at at time zone 'utc')::date
where joined_at is null;

alter table public.members
  alter column joined_at set default (current_date);

create unique index if not exists members_email_unique
  on public.members (lower(email))
  where email is not null and length(trim(email)) > 0;

comment on column public.members.address is 'Street address (Adresse).';
comment on column public.members.postal_code is 'Postal code (Postnr).';
comment on column public.members.city is 'City / postal place (Poststed).';
comment on column public.members.email is 'Email (Epost). Unique when set.';
comment on column public.members.birth_year is 'Birth year (Fødselsår).';
comment on column public.members.member_type is 'Membership type (Type).';
comment on column public.members.joined_at is 'Date joined (Innmeldt).';

-- ---------------------------------------------------------------------------
-- member_coupons: individual slots with use timestamps
-- ---------------------------------------------------------------------------
create table if not exists public.member_coupons (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  allocated_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);

create index if not exists member_coupons_member_id_idx
  on public.member_coupons (member_id);

create index if not exists member_coupons_member_unused_idx
  on public.member_coupons (member_id)
  where used_at is null;

comment on table public.member_coupons is
  'Per-coupon slots for a member. used_at null = available; set when redeemed.';

alter table public.member_coupons enable row level security;

create policy "Admins can select member_coupons"
  on public.member_coupons
  for select
  to authenticated
  using (public.is_current_user_admin());

create policy "Admins can insert member_coupons"
  on public.member_coupons
  for insert
  to authenticated
  with check (public.is_current_user_admin());

create policy "Admins can update member_coupons"
  on public.member_coupons
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "Admins can delete member_coupons"
  on public.member_coupons
  for delete
  to authenticated
  using (public.is_current_user_admin());

grant select, insert, update, delete on public.member_coupons to authenticated;

-- ---------------------------------------------------------------------------
-- Sync helpers
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

  update public.members
  set coupons_remaining = least(greatest(v_remaining, 0), 3)
  where id = p_member_id;
end;
$$;

revoke all on function public.sync_member_coupons_remaining(uuid) from public;

create or replace function public.allocate_member_coupons(
  p_member_id uuid,
  p_count integer default 3
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_count is null or p_count <= 0 then
    return;
  end if;

  insert into public.member_coupons (member_id, allocated_at)
  select p_member_id, now()
  from generate_series(1, p_count);

  update public.members
  set last_allocation_at = now()
  where id = p_member_id;

  perform public.sync_member_coupons_remaining(p_member_id);
end;
$$;

revoke all on function public.allocate_member_coupons(uuid, integer) from public;

create or replace function public.clear_unused_member_coupons(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.member_coupons
  where member_id = p_member_id
    and used_at is null;

  perform public.sync_member_coupons_remaining(p_member_id);
end;
$$;

revoke all on function public.clear_unused_member_coupons(uuid) from public;

-- Migrate existing balance into unused slots (past uses are not recoverable).
do $$
declare
  r record;
  i integer;
begin
  for r in
    select id, coupons_remaining
    from public.members
    where coupons_remaining > 0
  loop
    for i in 1..r.coupons_remaining loop
      insert into public.member_coupons (member_id, allocated_at)
      values (r.id, coalesce(
        (select last_allocation_at from public.members where id = r.id),
        now()
      ));
    end loop;
  end loop;
end$$;

-- Keep coupons_remaining in sync when slots change
create or replace function public.member_coupons_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_member_coupons_remaining(
    coalesce(new.member_id, old.member_id)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists member_coupons_after_change on public.member_coupons;
create trigger member_coupons_after_change
  after insert or update or delete on public.member_coupons
  for each row
  execute function public.member_coupons_after_change();

-- Soften members_before_write: still normalize phone / force unpaid=0 remaining;
-- allocation of slots is handled by RPCs / paid-change logic (not auto on insert).
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

  if new.email is not null then
    new.email := nullif(lower(trim(new.email)), '');
  end if;

  if not new.paid then
    new.coupons_remaining := 0;
  else
    if new.coupons_remaining < 0 or new.coupons_remaining > 3 then
      raise exception 'coupons_remaining must be between 0 and 3';
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

-- When paid flips, clear or allocate slots after the row write
create or replace function public.members_after_paid_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unused integer;
begin
  if tg_op = 'UPDATE' and old.paid is distinct from new.paid then
    if not new.paid then
      perform public.clear_unused_member_coupons(new.id);
    else
      select count(*)::integer into v_unused
      from public.member_coupons
      where member_id = new.id
        and used_at is null;

      if v_unused = 0 then
        perform public.allocate_member_coupons(new.id, 3);
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
      perform public.allocate_member_coupons(new.id, 3);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists members_after_paid_change on public.members;
create trigger members_after_paid_change
  after insert or update of paid on public.members
  for each row
  execute function public.members_after_paid_change();

-- ---------------------------------------------------------------------------
-- Public lookup: count unused slots
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
  v_remaining integer;
begin
  v_phone := public.normalize_member_phone(p_phone);

  if v_phone is null or length(v_phone) < 8 then
    return jsonb_build_object('status', 'invalid_phone');
  end if;

  select m.id, m.paid, m.first_name
    into r
    from public.members m
    where m.phone = v_phone;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not r.paid then
    v_remaining := 0;
  else
    select count(*)::integer into v_remaining
    from public.member_coupons c
    where c.member_id = r.id
      and c.used_at is null;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'paid', r.paid,
    'coupons_remaining', coalesce(v_remaining, 0),
    'first_name', r.first_name
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: yearly refresh → replace unused slots with 3 fresh ones per paid member
-- ---------------------------------------------------------------------------
create or replace function public.admin_refresh_yearly_coupons()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  r record;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if not public.is_current_user_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  for r in select id from public.members where paid = true loop
    perform public.clear_unused_member_coupons(r.id);
    perform public.allocate_member_coupons(r.id, 3);
    n := n + 1;
  end loop;

  return jsonb_build_object('status', 'ok', 'updated_count', n);
end;
$$;

comment on function public.admin_refresh_yearly_coupons() is
  'Clears unused coupon slots and allocates 3 fresh unused slots for all paid members; admin only.';

-- ---------------------------------------------------------------------------
-- Admin: fuzzy member search
-- ---------------------------------------------------------------------------
create or replace function public.admin_search_members(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  q text := trim(coalesce(p_query, ''));
  q_digits text;
  result jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if not public.is_current_user_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if length(q) = 0 then
    return jsonb_build_object('status', 'ok', 'members', '[]'::jsonb);
  end if;

  q_digits := regexp_replace(q, '\D', '', 'g');

  select coalesce(jsonb_agg(row_data order by score desc, last_name, first_name), '[]'::jsonb)
    into result
  from (
    select
      jsonb_build_object(
        'id', m.id,
        'first_name', m.first_name,
        'last_name', m.last_name,
        'phone', m.phone,
        'email', m.email,
        'address', m.address,
        'postal_code', m.postal_code,
        'city', m.city,
        'birth_year', m.birth_year,
        'member_type', m.member_type,
        'joined_at', m.joined_at,
        'paid', m.paid,
        'coupons_remaining', m.coupons_remaining,
        'last_allocation_at', m.last_allocation_at,
        'created_at', m.created_at,
        'coupons', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', c.id,
              'allocated_at', c.allocated_at,
              'used_at', c.used_at
            )
            order by c.used_at nulls last, c.allocated_at, c.id
          )
          from public.member_coupons c
          where c.member_id = m.id
        ), '[]'::jsonb)
      ) as row_data,
      m.last_name,
      m.first_name,
      greatest(
        similarity(lower(m.first_name || ' ' || m.last_name), lower(q)),
        similarity(lower(coalesce(m.first_name, '')), lower(q)),
        similarity(lower(coalesce(m.last_name, '')), lower(q)),
        similarity(lower(coalesce(m.email, '')), lower(q)),
        similarity(lower(coalesce(m.address, '')), lower(q)),
        similarity(lower(coalesce(m.city, '')), lower(q)),
        similarity(lower(coalesce(m.postal_code, '')), lower(q)),
        similarity(lower(coalesce(m.member_type, '')), lower(q)),
        similarity(coalesce(m.phone, ''), coalesce(nullif(q_digits, ''), q)),
        similarity(coalesce(m.birth_year::text, ''), q),
        similarity(m.id::text, q),
        case
          when m.phone ilike '%' || q_digits || '%' and length(q_digits) >= 3 then 0.85
          else 0
        end,
        case
          when lower(coalesce(m.email, '')) like '%' || lower(q) || '%' then 0.7
          else 0
        end,
        case
          when lower(m.first_name || ' ' || m.last_name) like '%' || lower(q) || '%' then 0.65
          else 0
        end
      ) as score
    from public.members m
    where
      lower(m.first_name || ' ' || m.last_name) like '%' || lower(q) || '%'
      or lower(coalesce(m.email, '')) like '%' || lower(q) || '%'
      or lower(coalesce(m.address, '')) like '%' || lower(q) || '%'
      or lower(coalesce(m.city, '')) like '%' || lower(q) || '%'
      or lower(coalesce(m.postal_code, '')) like '%' || lower(q) || '%'
      or lower(coalesce(m.member_type, '')) like '%' || lower(q) || '%'
      or coalesce(m.birth_year::text, '') like '%' || q || '%'
      or m.id::text ilike '%' || q || '%'
      or (length(q_digits) >= 3 and m.phone like '%' || q_digits || '%')
      or (lower(m.first_name || ' ' || m.last_name) % lower(q))
      or (lower(coalesce(m.email, '')) % lower(q))
      or (coalesce(m.phone, '') % coalesce(nullif(q_digits, ''), q))
    order by score desc, m.last_name, m.first_name
    limit 40
  ) ranked
  where score > 0.15 or length(q) >= 2;

  return jsonb_build_object('status', 'ok', 'members', coalesce(result, '[]'::jsonb));
end;
$$;

revoke all on function public.admin_search_members(text) from public;
grant execute on function public.admin_search_members(text) to authenticated;

comment on function public.admin_search_members(text) is
  'Fuzzy admin search across member profile fields; returns members with coupon slots.';

-- ---------------------------------------------------------------------------
-- Admin: set paid (+ allocate / clear unused coupons)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_member_paid(
  p_member_id uuid,
  p_paid boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.members%rowtype;
  coupons jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if not public.is_current_user_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  update public.members
  set paid = p_paid
  where id = p_member_id
  returning * into m;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'allocated_at', c.allocated_at,
      'used_at', c.used_at
    )
    order by c.used_at nulls last, c.allocated_at, c.id
  ), '[]'::jsonb)
    into coupons
  from public.member_coupons c
  where c.member_id = m.id;

  return jsonb_build_object(
    'status', 'ok',
    'member', to_jsonb(m),
    'coupons', coupons
  );
end;
$$;

revoke all on function public.admin_set_member_paid(uuid, boolean) from public;
grant execute on function public.admin_set_member_paid(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: use one coupon (oldest unused)
-- ---------------------------------------------------------------------------
create or replace function public.admin_use_member_coupon(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.members%rowtype;
  c public.member_coupons%rowtype;
  coupons jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if not public.is_current_user_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select * into m from public.members where id = p_member_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not m.paid then
    return jsonb_build_object('status', 'not_paid');
  end if;

  select * into c
  from public.member_coupons
  where member_id = p_member_id
    and used_at is null
  order by allocated_at, id
  limit 1
  for update;

  if not found then
    return jsonb_build_object('status', 'no_coupons');
  end if;

  update public.member_coupons
  set
    used_at = now(),
    used_by = auth.uid()
  where id = c.id
  returning * into c;

  select * into m from public.members where id = p_member_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', mc.id,
      'allocated_at', mc.allocated_at,
      'used_at', mc.used_at
    )
    order by mc.used_at nulls last, mc.allocated_at, mc.id
  ), '[]'::jsonb)
    into coupons
  from public.member_coupons mc
  where mc.member_id = p_member_id;

  return jsonb_build_object(
    'status', 'ok',
    'member', to_jsonb(m),
    'coupons', coupons,
    'used_coupon', jsonb_build_object(
      'id', c.id,
      'allocated_at', c.allocated_at,
      'used_at', c.used_at
    )
  );
end;
$$;

revoke all on function public.admin_use_member_coupon(uuid) from public;
grant execute on function public.admin_use_member_coupon(uuid) to authenticated;

comment on function public.admin_use_member_coupon(uuid) is
  'Marks the oldest unused coupon slot as used for a paid member; admin only.';
