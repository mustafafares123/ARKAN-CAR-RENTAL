-- ARKAN advanced operations: branch foundation and richer inspection records.
-- Additive migration: existing companies and business records are preserved.
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text not null,
  address text,
  phone text,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);
create index if not exists branches_company_active_idx on public.branches(company_id, is_active);

-- Every existing company receives a default branch before records are linked.
insert into public.branches(company_id, name, code, is_active, is_default)
select c.id, 'المقر الرئيسي', 'MAIN', true, true
from public.companies c
where not exists (select 1 from public.branches b where b.company_id = c.id);

create table if not exists public.branch_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('manager','staff','accountant','viewer')),
  created_at timestamptz not null default now(),
  primary key (branch_id, user_id)
);
create index if not exists branch_members_user_idx on public.branch_members(user_id, company_id);

alter table public.cars add column if not exists branch_id uuid references public.branches(id);
alter table public.arkan_records add column if not exists branch_id uuid references public.branches(id);
alter table public.vehicle_inspections add column if not exists branch_id uuid references public.branches(id);
alter table public.vehicle_inspections add column if not exists damage_notes text;
alter table public.vehicle_inspections add column if not exists customer_acknowledged boolean not null default false;

update public.cars c set branch_id = b.id
from public.branches b
where c.company_id = b.company_id and b.is_default and c.branch_id is null;
update public.arkan_records r set branch_id = b.id
from public.branches b
where r.company_id = b.company_id and b.is_default and r.branch_id is null;
update public.vehicle_inspections i set branch_id = b.id
from public.branches b
where i.company_id = b.company_id and b.is_default and i.branch_id is null;

alter table public.cars alter column branch_id set not null;
alter table public.arkan_records alter column branch_id set not null;
alter table public.vehicle_inspections alter column branch_id set not null;

create index if not exists cars_company_branch_idx on public.cars(company_id, branch_id);
create index if not exists arkan_records_company_branch_section_idx on public.arkan_records(company_id, branch_id, section, created_at desc);
create index if not exists inspections_company_branch_idx on public.vehicle_inspections(company_id, branch_id, created_at desc);

create or replace function public.can_access_branch(target_company uuid, target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company
      and cm.user_id = (select auth.uid())
      and (
        cm.role in ('owner','admin','manager')
        or exists (
          select 1 from public.branch_members bm
          where bm.company_id = target_company
            and bm.branch_id = target_branch
            and bm.user_id = (select auth.uid())
        )
      )
  );
$$;
revoke all on function public.can_access_branch(uuid, uuid) from public;
grant execute on function public.can_access_branch(uuid, uuid) to authenticated;

alter table public.branches enable row level security;
alter table public.branch_members enable row level security;
drop policy if exists "ARKAN branches read" on public.branches;
create policy "ARKAN branches read" on public.branches
for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "ARKAN branches insert" on public.branches;
create policy "ARKAN branches insert" on public.branches
for insert to authenticated with check (public.has_company_role(company_id, array['owner','admin','manager']));
drop policy if exists "ARKAN branches update" on public.branches;
create policy "ARKAN branches update" on public.branches
for update to authenticated using (public.has_company_role(company_id, array['owner','admin','manager']))
with check (public.has_company_role(company_id, array['owner','admin','manager']));
drop policy if exists "ARKAN branches delete" on public.branches;
create policy "ARKAN branches delete" on public.branches
for delete to authenticated using (public.has_company_role(company_id, array['owner','admin']));

drop policy if exists "ARKAN branch members read" on public.branch_members;
create policy "ARKAN branch members read" on public.branch_members
for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "ARKAN branch members manage" on public.branch_members;
create policy "ARKAN branch members manage" on public.branch_members
for all to authenticated using (public.has_company_role(company_id, array['owner','admin']))
with check (public.has_company_role(company_id, array['owner','admin']));

-- Replace company-wide data policies with branch-aware policies.
drop policy if exists "ARKAN cars read" on public.cars;
drop policy if exists "ARKAN cars insert" on public.cars;
drop policy if exists "ARKAN cars update" on public.cars;
drop policy if exists "ARKAN cars delete" on public.cars;
create policy "ARKAN cars read" on public.cars
for select to authenticated using (public.can_access_branch(company_id, branch_id));
create policy "ARKAN cars insert" on public.cars
for insert to authenticated with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and public.can_access_branch(company_id, branch_id)
);
create policy "ARKAN cars update" on public.cars
for update to authenticated using (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and public.can_access_branch(company_id, branch_id)
) with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and public.can_access_branch(company_id, branch_id)
);
create policy "ARKAN cars delete" on public.cars
for delete to authenticated using (
  public.has_company_role(company_id, array['owner','admin','manager'])
  and public.can_access_branch(company_id, branch_id)
);

drop policy if exists "ARKAN records read" on public.arkan_records;
drop policy if exists "ARKAN records insert" on public.arkan_records;
drop policy if exists "ARKAN records update" on public.arkan_records;
drop policy if exists "ARKAN records delete" on public.arkan_records;
create policy "ARKAN records read" on public.arkan_records
for select to authenticated using (public.can_access_branch(company_id, branch_id));
create policy "ARKAN records insert" on public.arkan_records
for insert to authenticated with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff','accountant'])
  and public.can_access_branch(company_id, branch_id)
  and (created_by is null or created_by = (select auth.uid()))
);
create policy "ARKAN records update" on public.arkan_records
for update to authenticated using (
  public.has_company_role(company_id, array['owner','admin','manager','staff','accountant'])
  and public.can_access_branch(company_id, branch_id)
) with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff','accountant'])
  and public.can_access_branch(company_id, branch_id)
);
create policy "ARKAN records delete" on public.arkan_records
for delete to authenticated using (
  public.has_company_role(company_id, array['owner','admin','manager'])
  and public.can_access_branch(company_id, branch_id)
);

drop policy if exists "ARKAN inspections read" on public.vehicle_inspections;
drop policy if exists "ARKAN inspections insert" on public.vehicle_inspections;
drop policy if exists "ARKAN inspections update" on public.vehicle_inspections;
drop policy if exists "ARKAN inspections delete" on public.vehicle_inspections;
create policy "ARKAN inspections read" on public.vehicle_inspections
for select to authenticated using (public.can_access_branch(company_id, branch_id));
create policy "ARKAN inspections insert" on public.vehicle_inspections
for insert to authenticated with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and public.can_access_branch(company_id, branch_id)
  and (created_by is null or created_by = (select auth.uid()))
);
create policy "ARKAN inspections update" on public.vehicle_inspections
for update to authenticated using (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and public.can_access_branch(company_id, branch_id)
) with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and public.can_access_branch(company_id, branch_id)
);
create policy "ARKAN inspections delete" on public.vehicle_inspections
for delete to authenticated using (
  public.has_company_role(company_id, array['owner','admin','manager'])
  and public.can_access_branch(company_id, branch_id)
);

-- Keep the existing private storage bucket and media paths unchanged.
