-- ARKAN customer eligibility, private identity documents and SMS reminder queue.
-- Run after schema.sql and cloud_cars.sql.
alter table public.customers
  add column if not exists date_of_birth date,
  add column if not exists license_issue_date date,
  add column if not exists license_expiry_date date,
  add column if not exists identity_front_path text,
  add column if not exists identity_back_path text,
  add column if not exists license_image_path text;

-- Store any number of optional secondary phone numbers without replacing the primary phone.
alter table public.customers
  add column if not exists additional_phones text[] not null default '{}';

-- Do not use time-dependent CHECK constraints here: a licence can expire simply
-- because the calendar advances. Enforce eligibility at every booking/contract write.
alter table public.customers
  drop constraint if exists customers_minimum_age_check,
  drop constraint if exists customers_license_tenure_check,
  drop constraint if exists customers_license_validity_check,
  drop constraint if exists customers_identity_images_check;

alter table public.customers
  add constraint customers_identity_images_check
  check (identity_front_path is not null and identity_back_path is not null);

create or replace function public.assert_customer_eligible_for_rental(target_customer uuid, target_company uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c public.customers%rowtype;
begin
  if target_customer is null then
    raise exception 'A customer must be linked to this rental';
  end if;

  select * into c
  from public.customers
  where id = target_customer and company_id = target_company;

  if c.id is null then
    raise exception 'Customer was not found in this company';
  end if;
  if c.date_of_birth is null or c.date_of_birth > (current_date - interval '24 years')::date then
    raise exception 'Rental rejected: customer must be at least 24 years old';
  end if;
  if c.license_issue_date is null or c.license_issue_date >= (current_date - interval '2 years')::date then
    raise exception 'Rental rejected: driving licence must have been held for more than two full years';
  end if;
  if c.license_expiry_date is null or c.license_expiry_date < current_date
     or c.license_expiry_date <= c.license_issue_date then
    raise exception 'Rental rejected: driving licence is expired or invalid';
  end if;
  if c.identity_front_path is null or c.identity_back_path is null then
    raise exception 'Rental rejected: both sides of the identity document are required';
  end if;
end;
$$;

create or replace function public.enforce_booking_customer_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_customer_eligible_for_rental(new.customer_id, new.company_id);
  return new;
end;
$$;

drop trigger if exists bookings_customer_eligibility on public.bookings;
create trigger bookings_customer_eligibility
before insert or update of customer_id, company_id
on public.bookings
for each row execute function public.enforce_booking_customer_eligibility();

create or replace function public.enforce_contract_customer_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Re-check on every contract write, including activation/pickup status changes,
  -- so a licence that expired after booking cannot pass vehicle handover.
  perform public.assert_customer_eligible_for_rental(new.customer_id, new.company_id);
  return new;
end;
$$;

drop trigger if exists contracts_customer_eligibility on public.contracts;
create trigger contracts_customer_eligibility
before insert or update
on public.contracts
for each row execute function public.enforce_contract_customer_eligibility();

-- Private documents share the existing private bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('arkan-private','arkan-private',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "ARKAN members read customer documents" on storage.objects;
create policy "ARKAN members read customer documents" on storage.objects for select to authenticated
using(bucket_id='arkan-private' and public.is_company_member((storage.foldername(name))[1]::uuid));
drop policy if exists "ARKAN members upload customer documents" on storage.objects;
create policy "ARKAN members upload customer documents" on storage.objects for insert to authenticated
with check(bucket_id='arkan-private' and public.is_company_member((storage.foldername(name))[1]::uuid));
drop policy if exists "ARKAN members update customer documents" on storage.objects;
create policy "ARKAN members update customer documents" on storage.objects for update to authenticated
using(bucket_id='arkan-private' and public.is_company_member((storage.foldername(name))[1]::uuid))
with check(bucket_id='arkan-private' and public.is_company_member((storage.foldername(name))[1]::uuid));
drop policy if exists "ARKAN managers delete customer documents" on storage.objects;
create policy "ARKAN managers delete customer documents" on storage.objects for delete to authenticated
using(bucket_id='arkan-private' and exists(select 1 from public.company_members m where m.company_id=(storage.foldername(name))[1]::uuid and m.user_id=auth.uid() and m.role in ('owner','admin','manager')));

create table if not exists public.sms_reminders(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 booking_id uuid not null references public.bookings(id) on delete cascade,
 customer_id uuid references public.customers(id),
 phone text not null,
 message text not null,
 scheduled_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')),
 provider_message_id text,
 error_message text,
 sent_at timestamptz,
 created_at timestamptz not null default now(),
 unique(booking_id,scheduled_at)
);
alter table public.sms_reminders enable row level security;
drop policy if exists "members read sms reminders" on public.sms_reminders;
create policy "members read sms reminders" on public.sms_reminders for select using(public.is_company_member(company_id));
drop policy if exists "members insert sms reminders" on public.sms_reminders;
create policy "members insert sms reminders" on public.sms_reminders for insert with check(public.is_company_member(company_id));
drop policy if exists "members update sms reminders" on public.sms_reminders;
create policy "members update sms reminders" on public.sms_reminders for update using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));

create or replace function public.schedule_booking_return_sms()
returns trigger language plpgsql security definer set search_path=public
as $$
declare c public.customers%rowtype; co uuid; scheduled timestamptz;
begin
 if new.customer_id is null then return new; end if;
 select * into c from public.customers where id=new.customer_id and company_id=new.company_id;
 if c.id is null or c.phone is null or length(trim(c.phone))<7 then return new; end if;
 scheduled := (new.end_date::timestamp at time zone 'Asia/Gaza') - interval '2 hours';
 if scheduled <= now() then return new; end if;
 insert into public.sms_reminders(company_id,booking_id,customer_id,phone,message,scheduled_at)
 values(new.company_id,new.id,c.id,c.phone,
   'ARKAN CO.: نذكّركم بموعد إعادة السيارة بتاريخ '||to_char(new.end_date,'YYYY-MM-DD')||'. يرجى الالتزام بالموعد. للاستفسار يرجى التواصل مع الشركة.',
   scheduled)
 on conflict(booking_id,scheduled_at) do update set phone=excluded.phone,message=excluded.message,status='pending',error_message=null;
 return new;
end;
$$;
drop trigger if exists booking_return_sms_schedule on public.bookings;
create trigger booking_return_sms_schedule after insert or update of end_date,customer_id,status on public.bookings
for each row when (new.status not in ('cancelled','canceled'))
execute function public.schedule_booking_return_sms();

-- SMS delivery requires a server-side worker + SMS provider credentials.
-- Never place SMS provider secrets in NEXT_PUBLIC_* browser variables.
