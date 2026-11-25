-- ARKAN legacy-table RLS hardening.
-- Existing operational UI uses branch-scoped arkan_records; these policies also
-- protect the legacy normalized tables so they cannot become an RLS bypass.
alter table public.expenses add column if not exists company_id uuid references public.companies(id) on delete cascade;
update public.expenses e set company_id = c.company_id
from public.cars c where e.car_id = c.id and e.company_id is null;
alter table public.audit_logs add column if not exists company_id uuid references public.companies(id) on delete cascade;

-- Remove anonymous execution of the branch authorization helper. Policies call
-- it as the authenticated user; the browser does not need to invoke it as RPC.
revoke execute on function public.can_access_branch(uuid, uuid) from PUBLIC, anon;
grant execute on function public.can_access_branch(uuid, uuid) to authenticated;

-- Normalized bookings are company scoped.
drop policy if exists "ARKAN legacy bookings read" on public.bookings;
drop policy if exists "ARKAN legacy bookings insert" on public.bookings;
drop policy if exists "ARKAN legacy bookings update" on public.bookings;
drop policy if exists "ARKAN legacy bookings delete" on public.bookings;
create policy "ARKAN legacy bookings read" on public.bookings
for select to authenticated using (public.is_company_member(company_id));
create policy "ARKAN legacy bookings insert" on public.bookings
for insert to authenticated with check (public.has_company_role(company_id, array['owner','admin','manager','staff']));
create policy "ARKAN legacy bookings update" on public.bookings
for update to authenticated using (public.has_company_role(company_id, array['owner','admin','manager','staff']))
with check (public.has_company_role(company_id, array['owner','admin','manager','staff']));
create policy "ARKAN legacy bookings delete" on public.bookings
for delete to authenticated using (public.has_company_role(company_id, array['owner','admin','manager']));

-- Payments inherit their tenant boundary and finance permissions from booking.
drop policy if exists "ARKAN legacy payments read" on public.payments;
drop policy if exists "ARKAN legacy payments insert" on public.payments;
drop policy if exists "ARKAN legacy payments update" on public.payments;
drop policy if exists "ARKAN legacy payments delete" on public.payments;
create policy "ARKAN legacy payments read" on public.payments
for select to authenticated using (exists (
  select 1 from public.bookings b where b.id = booking_id and public.is_company_member(b.company_id)
));
create policy "ARKAN legacy payments insert" on public.payments
for insert to authenticated with check (exists (
  select 1 from public.bookings b where b.id = booking_id
    and public.has_company_role(b.company_id, array['owner','admin','manager','accountant'])
));
create policy "ARKAN legacy payments update" on public.payments
for update to authenticated using (exists (
  select 1 from public.bookings b where b.id = booking_id
    and public.has_company_role(b.company_id, array['owner','admin','manager','accountant'])
)) with check (exists (
  select 1 from public.bookings b where b.id = booking_id
    and public.has_company_role(b.company_id, array['owner','admin','manager','accountant'])
));
create policy "ARKAN legacy payments delete" on public.payments
for delete to authenticated using (exists (
  select 1 from public.bookings b where b.id = booking_id
    and public.has_company_role(b.company_id, array['owner','admin'])
));

-- Legacy expenses are tenant-scoped explicitly; existing rows linked to cars
-- are backfilled without changing their amounts or descriptions.
drop policy if exists "ARKAN legacy expenses read" on public.expenses;
drop policy if exists "ARKAN legacy expenses insert" on public.expenses;
drop policy if exists "ARKAN legacy expenses update" on public.expenses;
drop policy if exists "ARKAN legacy expenses delete" on public.expenses;
create policy "ARKAN legacy expenses read" on public.expenses
for select to authenticated using (public.is_company_member(company_id));
create policy "ARKAN legacy expenses insert" on public.expenses
for insert to authenticated with check (public.has_company_role(company_id, array['owner','admin','manager','accountant']));
create policy "ARKAN legacy expenses update" on public.expenses
for update to authenticated using (public.has_company_role(company_id, array['owner','admin','manager','accountant']))
with check (public.has_company_role(company_id, array['owner','admin','manager','accountant']));
create policy "ARKAN legacy expenses delete" on public.expenses
for delete to authenticated using (public.has_company_role(company_id, array['owner','admin']));

-- Legacy inspections inherit access through their booking or vehicle.
drop policy if exists "ARKAN legacy inspections read" on public.inspections;
drop policy if exists "ARKAN legacy inspections insert" on public.inspections;
drop policy if exists "ARKAN legacy inspections update" on public.inspections;
drop policy if exists "ARKAN legacy inspections delete" on public.inspections;
create policy "ARKAN legacy inspections read" on public.inspections
for select to authenticated using (
  exists (select 1 from public.bookings b where b.id = booking_id and public.is_company_member(b.company_id))
  or exists (select 1 from public.cars c where c.id = car_id and public.is_company_member(c.company_id))
);
create policy "ARKAN legacy inspections insert" on public.inspections
for insert to authenticated with check (
  exists (select 1 from public.bookings b where b.id = booking_id and public.has_company_role(b.company_id, array['owner','admin','manager','staff']))
  or exists (select 1 from public.cars c where c.id = car_id and public.has_company_role(c.company_id, array['owner','admin','manager','staff']))
);
create policy "ARKAN legacy inspections update" on public.inspections
for update to authenticated using (
  exists (select 1 from public.bookings b where b.id = booking_id and public.has_company_role(b.company_id, array['owner','admin','manager','staff']))
  or exists (select 1 from public.cars c where c.id = car_id and public.has_company_role(c.company_id, array['owner','admin','manager','staff']))
) with check (
  exists (select 1 from public.bookings b where b.id = booking_id and public.has_company_role(b.company_id, array['owner','admin','manager','staff']))
  or exists (select 1 from public.cars c where c.id = car_id and public.has_company_role(c.company_id, array['owner','admin','manager','staff']))
);
create policy "ARKAN legacy inspections delete" on public.inspections
for delete to authenticated using (
  exists (select 1 from public.bookings b where b.id = booking_id and public.has_company_role(b.company_id, array['owner','admin','manager']))
  or exists (select 1 from public.cars c where c.id = car_id and public.has_company_role(c.company_id, array['owner','admin','manager']))
);

-- Audit records can be read by their company; a user can only create a record
-- attributed to themselves. No client-side update/delete policies are granted.
drop policy if exists "ARKAN audit logs read" on public.audit_logs;
drop policy if exists "ARKAN audit logs insert" on public.audit_logs;
create policy "ARKAN audit logs read" on public.audit_logs
for select to authenticated using (
  (company_id is not null and public.is_company_member(company_id))
  or user_id = (select auth.uid())
);
create policy "ARKAN audit logs insert" on public.audit_logs
for insert to authenticated with check (
  user_id = (select auth.uid())
  and (company_id is null or public.is_company_member(company_id))
);

-- User profiles are private to the corresponding Auth user.
drop policy if exists "ARKAN profiles read own" on public.profiles;
drop policy if exists "ARKAN profiles insert own" on public.profiles;
drop policy if exists "ARKAN profiles update own" on public.profiles;
create policy "ARKAN profiles read own" on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy "ARKAN profiles insert own" on public.profiles
for insert to authenticated with check (id = (select auth.uid()));
create policy "ARKAN profiles update own" on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));
