-- Store Norwegian mobiles as 8 digits (no country code).
-- Lookup still accepts +47 / 47… input via normalize_member_phone.

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
    -- Strip leading country code 47 when followed by an 8-digit mobile
    when length(t.digits) = 10 and left(t.digits, 2) = '47' then right(t.digits, 8)
    when length(t.digits) = 11 and left(t.digits, 3) = '047' then right(t.digits, 8)
    else t.digits
  end
  from t;
$$;

comment on function public.normalize_member_phone(text) is
  'Digits only; strips leading 47/047 so Norwegian mobiles are stored as 8 digits.';

comment on column public.members.phone is
  'Digit-only phone (Norwegian mobiles: 8 digits). Unique when present; NULL when unknown.';

-- Re-normalize existing rows so stored 47XXXXXXXX become XXXXXXXX
update public.members
set phone = public.normalize_member_phone(phone)
where phone is not null;
