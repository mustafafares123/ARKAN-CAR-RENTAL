-- ARKAN production hardening migration
-- Apply AFTER supabase/schema.sql in the Supabase SQL Editor.
-- Safe to re-run. Does not change project URL, API keys, or existing records.

create extension if not exists pgcrypto;

-- Company membership and role helpers. SECURITY DEFINER avoids RLS recursion
-- while keeping the lookup scoped to the signed-in user.
create or replace function public.is_company_member(target_company uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = target_company and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_company_role(target_company uuid, allowed_roles text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = target_company
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_company_member(uuid) from public;
revoke all on function public.has_company_role(uuid, text[]) from public;
grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.has_company_role(uuid, text[]) to authenticated;

-- One-time bootstrap: the first authenticated user creates the company and
-- becomes its owner. Subsequent calls return the user's existing company.
create or replace function public.create_or_get_my_company(company_name text default 'ARKAN CO. – RENT A CAR')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_company uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select company_id into current_company
  from public.company_members
  where user_id = auth.uid() and role = 'owner'
  order by company_id
  limit 1;

  if current_company is not null then
    return current_company;
  end if;

  insert into public.companies(name)
  values (coalesce(nullif(trim(company_name), ''), 'ARKAN CO. – RENT A CAR'))
  returning id into current_company;

  insert into public.company_members(company_id, user_id, role)
  values (current_company, auth.uid(), 'owner');

  return current_company;
end;
$$;

revoke all on function public.create_or_get_my_company(text) from public;
grant execute on function public.create_or_get_my_company(text) to authenticated;

-- Useful operational fields. Additive only; existing data is preserved.
alter table public.cars
  add column if not exists image_path text,
  add column if not exists color text,
  add column if not exists fuel_type text,
  add column if not exists transmission text,
  add column if not exists seats integer,
  add column if not exists mileage integer,
  add column if not exists insurance_expiry date,
  add column if not exists registration_expiry date;

alter table public.customers
  add column if not exists address text,
  add column if not exists license_no text,
  add column if not exists license_expiry date;

alter table public.bookings
  add column if not exists pickup_location text,
  add column if not exists return_location text,
  add column if not exists quoted_amount numeric(12,2) not null default 0,
  add column if not exists currency text not null default 'ILS';

alter table public.contracts
  add column if not exists pickup_location text,
  add column if not exists return_location text,
  add column if not exists deposit_amount numeric(12,2) not null default 0,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists signed_at timestamptz;

alter table public.company_members
  add column if not exists created_at timestamptz not null default now();

create index if not exists cars_company_plate_idx on public.cars(company_id, plate);
create index if not exists customers_company_phone_idx on public.customers(company_id, phone);
create index if not exists bookings_company_dates_idx on public.bookings(company_id, start_date, end_date);
create index if not exists contracts_company_no_idx on public.contracts(company_id, contract_no);
create index if not exists cash_company_date_idx on public.cash_transactions(company_id, transaction_date desc);
create index if not exists audit_company_created_idx on public.audit_log(company_id, created_at desc);

-- Replace permissive member-wide write policies with role-aware policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'cars','customers','bookings','contracts','cash_transactions',
    'maintenance','gps_devices','gps_positions','traffic_fines','audit_log'
  ] loop
    execute format('drop policy if exists "members can read %I" on public.%I', t, t);
    execute format('drop policy if exists "members can insert %I" on public.%I', t, t);
    execute format('drop policy if exists "members can update %I" on public.%I', t, t);
    execute format('drop policy if exists "members can delete %I" on public.%I', t, t);

    execute format(
      'create policy "company members can read %I" on public.%I for select to authenticated using (public.is_company_member(company_id))',
      t, t
    );

    if t = 'cash_transactions' then
      execute format(
        'create policy "finance roles can insert %I" on public.%I for insert to authenticated with check (public.has_company_role(company_id, array[''owner'',''admin'',''manager'',''accountant'']))',
        t, t
      );
      execute format(
        'create policy "finance roles can update %I" on public.%I for update to authenticated using (public.has_company_role(company_id, array[''owner'',''admin'',''manager'',''accountant''])) with check (public.has_company_role(company_id, array[''owner'',''admin'',''manager'',''accountant'']))',
        t, t
      );
      execute format(
        'create policy "admins can delete %I" on public.%I for delete to authenticated using (public.has_company_role(company_id, array[''owner'',''admin'']))',
        t, t
      );
    elsif t = 'audit_log' then
      execute format(
        'create policy "company members can add audit %I" on public.%I for insert to authenticated with check (public.is_company_member(company_id) and actor_id = auth.uid())',
        t, t
      );
    else
      execute format(
        'create policy "staff can insert %I" on public.%I for insert to authenticated with check (public.has_company_role(company_id, array[''owner'',''admin'',''manager'',''staff'']))',
        t, t
      );
      execute format(
        'create policy "staff can update %I" on public.%I for update to authenticated using (public.has_company_role(company_id, array[''owner'',''admin'',''manager'',''staff''])) with check (public.has_company_role(company_id, array[''owner'',''admin'',''manager'',''staff'']))',
        t, t
      );
      execute format(
        'create policy "managers can delete %I" on public.%I for delete to authenticated using (public.has_company_role(company_id, array[''owner'',''admin'',''manager'']))',
        t, t
      );
    end if;
  end loop;
end $$;

-- Company records and membership: users can see only their own company/membership.
drop policy if exists "members read own company" on public.companies;
create policy "members read own company" on public.companies
  for select to authenticated using (public.is_company_member(id));

drop policy if exists "members read membership" on public.company_members;
create policy "members read membership" on public.company_members
  for select to authenticated using (user_id = auth.uid() or public.is_company_member(company_id));

-- Keep private customer documents and vehicle photos in a private bucket.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'arkan-private',
  'arkan-private',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ARKAN members read private files" on storage.objects;
create policy "ARKAN members read private files" on storage.objects
for select to authenticated
using (
  bucket_id = 'arkan-private'
  and public.is_company_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "ARKAN staff upload private files" on storage.objects;
create policy "ARKAN staff upload private files" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'arkan-private'
  and public.has_company_role((storage.foldername(name))[1]::uuid, array['owner','admin','manager','staff'])
);

drop policy if exists "ARKAN managers update private files" on storage.objects;
create policy "ARKAN managers update private files" on storage.objects
for update to authenticated
using (
  bucket_id = 'arkan-private'
  and public.has_company_role((storage.foldername(name))[1]::uuid, array['owner','admin','manager'])
)
with check (
  bucket_id = 'arkan-private'
  and public.has_company_role((storage.foldername(name))[1]::uuid, array['owner','admin','manager'])
);

drop policy if exists "ARKAN managers delete private files" on storage.objects;
create policy "ARKAN managers delete private files" on storage.objects
for delete to authenticated
using (
  bucket_id = 'arkan-private'
  and public.has_company_role((storage.foldername(name))[1]::uuid, array['owner','admin','manager'])
);

-- IMPORTANT:
-- 1) Never put the Supabase service_role key in browser code or NEXT_PUBLIC_* variables.
-- 2) Create separate Auth users for staff; assign their roles through a trusted admin workflow.
-- 3) Test this migration in the Supabase SQL Editor and verify backups before live customer data.
