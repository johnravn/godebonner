-- Club-sheet external IDs + per-year payment history for CSV import.
-- members.paid remains the current-year paid flag used by coupon logic.

alter table public.members
  add column if not exists external_id text;

create unique index if not exists members_external_id_unique
  on public.members (external_id)
  where external_id is not null and length(trim(external_id)) > 0;

comment on column public.members.external_id is
  'Legacy club-sheet member ID (CSV ID). Unique when set.';

-- ---------------------------------------------------------------------------
-- member_payments: one row per member per year
-- ---------------------------------------------------------------------------
create table if not exists public.member_payments (
  member_id uuid not null references public.members (id) on delete cascade,
  year smallint not null check (year between 2000 and 2100),
  paid boolean not null default true,
  recorded_at timestamptz not null default now(),
  primary key (member_id, year)
);

comment on table public.member_payments is
  'Yearly membership payment status. members.paid mirrors the current calendar year.';

alter table public.member_payments enable row level security;

create policy "Admins can select member_payments"
  on public.member_payments
  for select
  to authenticated
  using (public.is_current_user_admin());

create policy "Admins can insert member_payments"
  on public.member_payments
  for insert
  to authenticated
  with check (public.is_current_user_admin());

create policy "Admins can update member_payments"
  on public.member_payments
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "Admins can delete member_payments"
  on public.member_payments
  for delete
  to authenticated
  using (public.is_current_user_admin());

grant select, insert, update, delete on public.member_payments to authenticated;

-- Backfill current-year payment rows from existing members.paid
insert into public.member_payments (member_id, year, paid)
select m.id, extract(year from current_date)::smallint, m.paid
from public.members m
on conflict (member_id, year) do nothing;
