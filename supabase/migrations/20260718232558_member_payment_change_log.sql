-- Audit log for membership payment status changes from Registrer kupong.
-- Snapshots member/user fields so history remains readable after deletes.

create table if not exists public.member_payment_change_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  member_id uuid references public.members (id) on delete set null,
  member_first_name text not null,
  member_last_name text not null,
  member_phone text,
  member_external_id text,
  year smallint not null check (year between 2000 and 2100),
  paid boolean not null,
  previous_paid boolean,
  changed_by uuid references auth.users (id) on delete set null,
  changed_by_email text
);

comment on table public.member_payment_change_log is
  'Append-only log of payment status changes (Registrer kupong / admin_set_member_paid).';

create index if not exists member_payment_change_log_created_at_idx
  on public.member_payment_change_log (created_at desc);

create index if not exists member_payment_change_log_member_id_idx
  on public.member_payment_change_log (member_id);

alter table public.member_payment_change_log enable row level security;

create policy "Admins can select member_payment_change_log"
  on public.member_payment_change_log
  for select
  to authenticated
  using (public.is_current_user_admin());

grant select on public.member_payment_change_log to authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_member_paid: sync member_payments + append change log
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
  'Sets members.paid for the current year, syncs member_payments, logs changes, and returns coupon slots.';
