-- Enforce the role assigned within each branch, not just company membership.
create or replace function public.has_branch_role(target_company uuid, target_branch uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members cm
    where cm.company_id=target_company and cm.user_id=(select auth.uid())
      and (
        cm.role in ('owner','admin','manager')
        or exists (
          select 1 from public.branch_members bm
          where bm.company_id=target_company and bm.branch_id=target_branch
            and bm.user_id=(select auth.uid()) and bm.role=any(allowed_roles)
        )
      )
  );
$$;
revoke all on function public.has_branch_role(uuid,uuid,text[]) from PUBLIC, anon;
grant execute on function public.has_branch_role(uuid,uuid,text[]) to authenticated;

drop policy if exists "ARKAN cars insert" on public.cars;
drop policy if exists "ARKAN cars update" on public.cars;
drop policy if exists "ARKAN cars delete" on public.cars;
create policy "ARKAN cars insert" on public.cars
for insert to authenticated with check (
  public.has_branch_role(company_id, branch_id, array['manager','staff'])
  and public.can_access_branch(company_id, branch_id)
);
create policy "ARKAN cars update" on public.cars
for update to authenticated using (
  public.has_branch_role(company_id, branch_id, array['manager','staff'])
  and public.can_access_branch(company_id, branch_id)
) with check (
  public.has_branch_role(company_id, branch_id, array['manager','staff'])
  and public.can_access_branch(company_id, branch_id)
);
create policy "ARKAN cars delete" on public.cars
for delete to authenticated using (
  public.has_branch_role(company_id, branch_id, array['manager'])
  and public.can_access_branch(company_id, branch_id)
);

drop policy if exists "ARKAN records insert" on public.arkan_records;
drop policy if exists "ARKAN records update" on public.arkan_records;
drop policy if exists "ARKAN records delete" on public.arkan_records;
create policy "ARKAN records insert" on public.arkan_records
for insert to authenticated with check (
  public.has_branch_role(company_id, branch_id, array['manager','staff','accountant'])
  and public.can_access_branch(company_id, branch_id)
  and (created_by is null or created_by=(select auth.uid()))
);
create policy "ARKAN records update" on public.arkan_records
for update to authenticated using (
  public.has_branch_role(company_id, branch_id, array['manager','staff','accountant'])
  and public.can_access_branch(company_id, branch_id)
) with check (
  public.has_branch_role(company_id, branch_id, array['manager','staff','accountant'])
  and public.can_access_branch(company_id, branch_id)
);
create policy "ARKAN records delete" on public.arkan_records
for delete to authenticated using (
  public.has_branch_role(company_id, branch_id, array['manager'])
  and public.can_access_branch(company_id, branch_id)
);

drop policy if exists "ARKAN inspections insert" on public.vehicle_inspections;
drop policy if exists "ARKAN inspections update" on public.vehicle_inspections;
drop policy if exists "ARKAN inspections delete" on public.vehicle_inspections;
create policy "ARKAN inspections insert" on public.vehicle_inspections
for insert to authenticated with check (
  public.has_branch_role(company_id, branch_id, array['manager','staff'])
  and public.can_access_branch(company_id, branch_id)
  and (created_by is null or created_by=(select auth.uid()))
);
create policy "ARKAN inspections update" on public.vehicle_inspections
for update to authenticated using (
  public.has_branch_role(company_id, branch_id, array['manager','staff'])
  and public.can_access_branch(company_id, branch_id)
) with check (
  public.has_branch_role(company_id, branch_id, array['manager','staff'])
  and public.can_access_branch(company_id, branch_id)
);
create policy "ARKAN inspections delete" on public.vehicle_inspections
for delete to authenticated using (
  public.has_branch_role(company_id, branch_id, array['manager'])
  and public.can_access_branch(company_id, branch_id)
);
