-- ARKAN vehicle gallery and handover/return evidence migration
-- Run once in Supabase SQL Editor after schema.sql and production_upgrade.sql.
alter table public.cars add column if not exists gallery_paths text[] not null default '{}';

create table if not exists public.vehicle_inspections (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 car_id uuid not null references public.cars(id) on delete restrict,
 car_plate text not null,
 contract_no text,
 stage text not null check (stage in ('pickup','return')),
 mileage integer check (mileage is null or mileage >= 0),
 fuel_level text,
 condition_notes text,
 media_paths text[] not null default '{}',
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists vehicle_inspections_company_contract_idx
 on public.vehicle_inspections(company_id, contract_no, created_at desc);
create index if not exists vehicle_inspections_car_idx
 on public.vehicle_inspections(company_id, car_id, created_at desc);

alter table public.vehicle_inspections enable row level security;
drop policy if exists "ARKAN members read vehicle inspections" on public.vehicle_inspections;
create policy "ARKAN members read vehicle inspections" on public.vehicle_inspections
 for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "ARKAN staff create vehicle inspections" on public.vehicle_inspections;
create policy "ARKAN staff create vehicle inspections" on public.vehicle_inspections
 for insert to authenticated with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and (created_by is null or created_by = auth.uid())
 );
drop policy if exists "ARKAN managers update vehicle inspections" on public.vehicle_inspections;
create policy "ARKAN managers update vehicle inspections" on public.vehicle_inspections
 for update to authenticated using (
  public.has_company_role(company_id, array['owner','admin','manager'])
 ) with check (
  public.has_company_role(company_id, array['owner','admin','manager'])
 );

-- Private bucket: images, videos and existing private documents.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('arkan-private','arkan-private',false,104857600,
 array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm','application/pdf'])
on conflict (id) do update set
 public=false,
 file_size_limit=104857600,
 allowed_mime_types=excluded.allowed_mime_types;

-- Existing company-scoped storage policies remain in force. Staff may upload
-- to their own company folder; only members can read signed/private evidence.
