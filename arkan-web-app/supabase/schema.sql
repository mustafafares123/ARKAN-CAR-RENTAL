-- ARKAN CO. – initial private database schema (Supabase / PostgreSQL)
-- Run in Supabase SQL Editor only after creating a private project.
create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'ARKAN CO. – RENT A CAR',
  created_at timestamptz not null default now()
);
create table if not exists public.company_members (
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','admin','manager','staff','accountant','viewer')),
  primary key(company_id,user_id)
);
create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  car_number text, plate text not null, make text, model text, year integer, status text not null default 'available',
  daily_rate numeric(12,2) default 0, currency text default 'ILS', vin text, notes text, created_at timestamptz default now()
);
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null, phone text, identity_no text, email text, private_document_path text, notes text, created_at timestamptz default now()
);
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id), car_id uuid references public.cars(id),
  start_date date not null, end_date date not null, status text default 'pending', notes text,
  check(end_date >= start_date), created_at timestamptz default now()
);
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  contract_no text not null, customer_id uuid references public.customers(id), car_id uuid references public.cars(id),
  start_at timestamptz, end_at timestamptz, actual_return_at timestamptz, total_amount numeric(12,2) default 0,
  currency text default 'ILS', status text default 'draft', terms jsonb default '{}'::jsonb, created_at timestamptz default now()
);
create table if not exists public.cash_transactions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  transaction_date date not null default current_date, kind text not null check(kind in ('receipt','payment')),
  description text, amount numeric(12,2) not null check(amount >= 0), currency text default 'ILS',
  contract_id uuid references public.contracts(id), reference_no text, created_at timestamptz default now()
);
create table if not exists public.maintenance (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  car_id uuid references public.cars(id), service_date date not null default current_date,
  service_type text, description text, cost numeric(12,2) default 0, currency text default 'ILS', created_at timestamptz default now()
);
create table if not exists public.gps_devices (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  car_id uuid references public.cars(id), device_no text, provider text, external_device_id text,
  connection_status text default 'unknown', last_seen timestamptz, created_at timestamptz default now()
);
create table if not exists public.gps_positions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  device_id uuid references public.gps_devices(id) on delete cascade, recorded_at timestamptz not null,
  latitude numeric(10,7), longitude numeric(10,7), speed_kmh numeric(8,2), source_payload jsonb
);
create table if not exists public.traffic_fines (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  car_id uuid references public.cars(id), contract_id uuid references public.contracts(id),
  fine_date timestamptz not null, fine_type text, location text, amount numeric(12,2) default 0,
  currency text default 'ILS', evidence_path text, verification_status text default 'pending',
  charge_customer boolean default false, collection_status text default 'unpaid', notes text, created_at timestamptz default now()
);
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references auth.users(id), action text not null, entity text, entity_id uuid,
  details jsonb default '{}'::jsonb, created_at timestamptz default now()
);

-- Membership helper used by row-level security policies.
create or replace function public.is_company_member(target_company uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.company_members m where m.company_id=target_company and m.user_id=auth.uid()); $$;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
do $$ declare t text; begin
 foreach t in array array['cars','customers','bookings','contracts','cash_transactions','maintenance','gps_devices','gps_positions','traffic_fines','audit_log'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy "members can read %I" on public.%I for select using (public.is_company_member(company_id))',t,t);
  execute format('create policy "members can insert %I" on public.%I for insert with check (public.is_company_member(company_id))',t,t);
  execute format('create policy "members can update %I" on public.%I for update using (public.is_company_member(company_id)) with check (public.is_company_member(company_id))',t,t);
  execute format('create policy "members can delete %I" on public.%I for delete using (public.is_company_member(company_id))',t,t);
 end loop;
end $$;

create policy "members read own company" on public.companies for select using (exists(select 1 from public.company_members m where m.company_id=id and m.user_id=auth.uid()));
create policy "members read membership" on public.company_members for select using (user_id=auth.uid());
-- IMPORTANT: create the first company and owner membership using a trusted server-side admin process.
-- Never expose the Supabase service_role key in a browser or commit it to Git.
