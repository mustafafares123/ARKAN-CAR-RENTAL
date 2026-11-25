-- Index branch-scoped foreign keys and simplify branch-member RLS policies.
create index if not exists arkan_records_branch_id_idx on public.arkan_records(branch_id);
create index if not exists arkan_records_created_by_idx on public.arkan_records(created_by);
create index if not exists audit_logs_branch_id_idx on public.audit_logs(branch_id);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists branch_members_company_id_idx on public.branch_members(company_id);
create index if not exists cars_branch_id_idx on public.cars(branch_id);
create index if not exists vehicle_inspections_branch_id_idx on public.vehicle_inspections(branch_id);
create index if not exists vehicle_inspections_car_id_idx on public.vehicle_inspections(car_id);
create index if not exists vehicle_inspections_created_by_idx on public.vehicle_inspections(created_by);
create index if not exists expenses_company_id_idx on public.expenses(company_id);
create index if not exists company_members_user_id_idx on public.company_members(user_id);

drop policy if exists "ARKAN branch members manage" on public.branch_members;
drop policy if exists "ARKAN branch members insert" on public.branch_members;
drop policy if exists "ARKAN branch members update" on public.branch_members;
drop policy if exists "ARKAN branch members delete" on public.branch_members;
create policy "ARKAN branch members insert" on public.branch_members
for insert to authenticated with check (public.has_company_role(company_id,array['owner','admin']));
create policy "ARKAN branch members update" on public.branch_members
for update to authenticated using (public.has_company_role(company_id,array['owner','admin']))
with check (public.has_company_role(company_id,array['owner','admin']));
create policy "ARKAN branch members delete" on public.branch_members
for delete to authenticated using (public.has_company_role(company_id,array['owner','admin']));

drop policy if exists "ARKAN membership read" on public.company_members;
create policy "ARKAN membership read" on public.company_members
for select to authenticated using ((user_id=(select auth.uid())) or public.is_company_member(company_id));
