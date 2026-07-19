-- Use a specific coupon slot (or oldest unused), restore (unuse) a coupon,
-- and return coupon slots from the public phone lookup.

-- Drop the old single-arg overload so PostgREST resolves the new signature.
drop function if exists public.admin_use_member_coupon(uuid);

-- ---------------------------------------------------------------------------
-- Admin: use one coupon (optional specific slot; else oldest unused)
-- ---------------------------------------------------------------------------
create or replace function public.admin_use_member_coupon(
  p_member_id uuid,
  p_coupon_id uuid default null
)
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

  if p_coupon_id is not null then
    select * into c
    from public.member_coupons
    where id = p_coupon_id
      and member_id = p_member_id
    for update;

    if not found then
      return jsonb_build_object('status', 'not_found');
    end if;

    if c.used_at is not null then
      return jsonb_build_object('status', 'already_used');
    end if;
  else
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

revoke all on function public.admin_use_member_coupon(uuid, uuid) from public;
grant execute on function public.admin_use_member_coupon(uuid, uuid) to authenticated;

comment on function public.admin_use_member_coupon(uuid, uuid) is
  'Marks a coupon slot as used (specific id or oldest unused) for a paid member; admin only.';

-- ---------------------------------------------------------------------------
-- Admin: restore (unuse) a used coupon slot
-- ---------------------------------------------------------------------------
create or replace function public.admin_unuse_member_coupon(p_coupon_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.member_coupons%rowtype;
  m public.members%rowtype;
  coupons jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if not public.is_current_user_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select * into c
  from public.member_coupons
  where id = p_coupon_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if c.used_at is null then
    return jsonb_build_object('status', 'not_used');
  end if;

  update public.member_coupons
  set
    used_at = null,
    used_by = null
  where id = c.id
  returning * into c;

  select * into m from public.members where id = c.member_id;

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
  where mc.member_id = c.member_id;

  return jsonb_build_object(
    'status', 'ok',
    'member', to_jsonb(m),
    'coupons', coupons,
    'restored_coupon', jsonb_build_object(
      'id', c.id,
      'allocated_at', c.allocated_at,
      'used_at', c.used_at
    )
  );
end;
$$;

revoke all on function public.admin_unuse_member_coupon(uuid) from public;
grant execute on function public.admin_unuse_member_coupon(uuid) to authenticated;

comment on function public.admin_unuse_member_coupon(uuid) is
  'Clears used_at on a coupon slot so it can be used again; admin only.';

-- ---------------------------------------------------------------------------
-- Public lookup: include current-period coupon slots for graphical display
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
  coupons jsonb;
begin
  v_phone := public.normalize_member_phone(p_phone);

  if v_phone is null or length(v_phone) < 8 then
    return jsonb_build_object('status', 'invalid_phone');
  end if;

  select m.id, m.paid, m.first_name, m.last_allocation_at
    into r
    from public.members m
    where m.phone = v_phone;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not r.paid then
    return jsonb_build_object(
      'status', 'ok',
      'paid', false,
      'coupons_remaining', 0,
      'first_name', r.first_name,
      'coupons', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'used', c.used_at is not null,
      'used_at', c.used_at
    )
    order by c.used_at nulls last, c.allocated_at, c.id
  ), '[]'::jsonb)
    into coupons
  from public.member_coupons c
  where c.member_id = r.id
    and (
      c.used_at is null
      or r.last_allocation_at is null
      or c.allocated_at >= r.last_allocation_at
    );

  select count(*)::integer into v_remaining
  from public.member_coupons c
  where c.member_id = r.id
    and c.used_at is null;

  return jsonb_build_object(
    'status', 'ok',
    'paid', true,
    'coupons_remaining', coalesce(v_remaining, 0),
    'first_name', r.first_name,
    'coupons', coalesce(coupons, '[]'::jsonb)
  );
end;
$$;
