-- Allow multiple members to share a phone. Identity key is external_id (and PK).
-- Public coupon lookup returns a candidate list when several members match.

drop index if exists public.members_phone_unique;

create index if not exists members_phone_idx
  on public.members (phone)
  where phone is not null;

comment on column public.members.phone is
  'Normalized Norwegian mobile (8 digits). Not unique — several members may share a number.';

-- Drop the one-arg overload so PostgREST exposes the two-arg form (default null).
drop function if exists public.get_coupons_by_phone(text);

create or replace function public.get_coupons_by_phone(
  p_phone text,
  p_member_id uuid default null
)
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
  v_count integer;
  candidates jsonb;
begin
  v_phone := public.normalize_member_phone(p_phone);

  if v_phone is null or length(v_phone) < 8 then
    return jsonb_build_object('status', 'invalid_phone');
  end if;

  if p_member_id is not null then
    select m.id, m.paid, m.first_name, m.last_allocation_at
      into r
      from public.members m
      where m.id = p_member_id
        and m.phone = v_phone;

    if not found then
      return jsonb_build_object('status', 'not_found');
    end if;
  else
    select count(*)::integer into v_count
    from public.members m
    where m.phone = v_phone;

    if v_count = 0 then
      return jsonb_build_object('status', 'not_found');
    end if;

    if v_count > 1 then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'member_id', m.id,
          'first_name', m.first_name,
          'last_name', m.last_name
        )
        order by m.last_name, m.first_name, m.id
      ), '[]'::jsonb)
        into candidates
      from public.members m
      where m.phone = v_phone;

      return jsonb_build_object(
        'status', 'multiple',
        'candidates', candidates
      );
    end if;

    select m.id, m.paid, m.first_name, m.last_allocation_at
      into r
      from public.members m
      where m.phone = v_phone;
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

revoke all on function public.get_coupons_by_phone(text, uuid) from public;
grant execute on function public.get_coupons_by_phone(text, uuid) to anon, authenticated;

comment on function public.get_coupons_by_phone(text, uuid) is
  'Public coupon lookup by phone. Returns ok for one match, multiple+candidates when several members share the number, or ok when p_member_id is provided and matches that phone.';
