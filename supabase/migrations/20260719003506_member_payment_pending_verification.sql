-- Pending payment verification: members marked paid in Registrer kupong
-- until confirmed by CSV import (or admin manual verify).

create table if not exists public.member_payment_pending_verification (
  member_id uuid primary key references public.members (id) on delete cascade,
  year smallint not null check (year between 2000 and 2100),
  marked_paid_at timestamptz not null default now(),
  imports_without_verification integer not null default 0
    check (imports_without_verification >= 0),
  last_import_missed_at timestamptz,
  member_first_name text not null,
  member_last_name text not null,
  member_phone text,
  created_at timestamptz not null default now()
);

comment on table public.member_payment_pending_verification is
  'Members marked paid via Registrer kupong awaiting CSV (or admin) verification.';

create index if not exists member_payment_pending_verification_marked_paid_at_idx
  on public.member_payment_pending_verification (marked_paid_at desc);

alter table public.member_payment_pending_verification enable row level security;

create policy "Admins can select member_payment_pending_verification"
  on public.member_payment_pending_verification
  for select
  to authenticated
  using (public.is_current_user_admin());

create policy "Admins can insert member_payment_pending_verification"
  on public.member_payment_pending_verification
  for insert
  to authenticated
  with check (public.is_current_user_admin());

create policy "Admins can update member_payment_pending_verification"
  on public.member_payment_pending_verification
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "Admins can delete member_payment_pending_verification"
  on public.member_payment_pending_verification
  for delete
  to authenticated
  using (public.is_current_user_admin());

grant select, insert, update, delete
  on public.member_payment_pending_verification to authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_member_paid: also maintain pending verification rows
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
  previous_paid boolean;
  payment_year smallint := extract(year from current_date)::smallint;
  actor uuid := auth.uid();
  actor_email text;
  coupons jsonb;
begin
  if actor is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if not public.is_current_user_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select * into m from public.members where id = p_member_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  previous_paid := m.paid;

  update public.members
  set paid = p_paid
  where id = p_member_id
  returning * into m;

  insert into public.member_payments (member_id, year, paid, recorded_at)
  values (p_member_id, payment_year, p_paid, now())
  on conflict (member_id, year) do update
  set paid = excluded.paid,
      recorded_at = excluded.recorded_at;

  if previous_paid is distinct from p_paid then
    select p.email into actor_email
    from public.profiles p
    where p.id = actor;

    insert into public.member_payment_change_log (
      member_id,
      member_first_name,
      member_last_name,
      member_phone,
      member_external_id,
      year,
      paid,
      previous_paid,
      changed_by,
      changed_by_email
    ) values (
      m.id,
      m.first_name,
      m.last_name,
      m.phone,
      m.external_id,
      payment_year,
      p_paid,
      previous_paid,
      actor,
      actor_email
    );
  end if;

  if p_paid then
    insert into public.member_payment_pending_verification (
      member_id,
      year,
      marked_paid_at,
      imports_without_verification,
      last_import_missed_at,
      member_first_name,
      member_last_name,
      member_phone
    ) values (
      m.id,
      payment_year,
      now(),
      0,
      null,
      m.first_name,
      m.last_name,
      m.phone
    )
    on conflict (member_id) do update
    set year = excluded.year,
        marked_paid_at = excluded.marked_paid_at,
        imports_without_verification = 0,
        last_import_missed_at = null,
        member_first_name = excluded.member_first_name,
        member_last_name = excluded.member_last_name,
        member_phone = excluded.member_phone;
  else
    delete from public.member_payment_pending_verification
    where member_id = p_member_id;
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

comment on function public.admin_set_member_paid(uuid, boolean) is
  'Sets members.paid for the current year, syncs member_payments, logs changes, maintains pending verification, and returns coupon slots.';

-- ---------------------------------------------------------------------------
-- admin_verify_member_payment: clear pending without changing paid status
-- ---------------------------------------------------------------------------
create or replace function public.admin_verify_member_payment(
  p_member_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  deleted integer;
begin
  if actor is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if not public.is_current_user_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  delete from public.member_payment_pending_verification
  where member_id = p_member_id;

  get diagnostics deleted = row_count;

  if deleted = 0 then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object('status', 'ok', 'member_id', p_member_id);
end;
$$;

revoke all on function public.admin_verify_member_payment(uuid) from public;
grant execute on function public.admin_verify_member_payment(uuid) to authenticated;

comment on function public.admin_verify_member_payment(uuid) is
  'Removes a member from the pending payment verification list without changing members.paid.';
