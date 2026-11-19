-- ARKAN unified cloud records
-- Run AFTER schema.sql, production_upgrade.sql and vehicle_media_inspections.sql.
-- Keeps the existing UI fields intact while synchronizing operational sections.
create table if not exists public.arkan_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  section text not null check (section in ('bookings','contracts','cash','maintenance','trackers','fines')),
  record_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists arkan_records_company_section_created_idx
  on public.arkan_records(company_id, section, created_at desc);
alter table public.arkan_records enable row level security;
drop policy if exists "ARKAN records members read" on public.arkan_records;
create policy "ARKAN records members read" on public.arkan_records
 for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "ARKAN records staff insert" on public.arkan_records;
create policy "ARKAN records staff insert" on public.arkan_records
 for insert to authenticated with check (
   public.has_company_role(company_id, array['owner','admin','manager','staff','accountant'])
   and (created_by is null or created_by = auth.uid())
 );
drop policy if exists "ARKAN records staff update" on public.arkan_records;
create policy "ARKAN records staff update" on public.arkan_records
 for update to authenticated
 using (public.has_company_role(company_id, array['owner','admin','manager','staff','accountant']))
 with check (public.has_company_role(company_id, array['owner','admin','manager','staff','accountant']));
drop policy if exists "ARKAN records managers delete" on public.arkan_records;
create policy "ARKAN records managers delete" on public.arkan_records
 for delete to authenticated using (public.has_company_role(company_id, array['owner','admin','manager']));
