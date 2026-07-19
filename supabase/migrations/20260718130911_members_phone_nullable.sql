-- Allow members without a mobile number (common in club CSV imports).
-- Uniqueness only applies when phone is present; multiple NULLs are allowed.

alter table public.members
  alter column phone drop not null;

drop index if exists public.members_phone_unique;

create unique index members_phone_unique
  on public.members (phone)
  where phone is not null and length(trim(phone)) > 0;

comment on column public.members.phone is
  'E.164-style digits (normalized). Unique when present; NULL when unknown.';

-- Soften before-write: blank / invalid input becomes NULL instead of raising.
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
