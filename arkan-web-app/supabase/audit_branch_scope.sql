-- Keep the activity log within the same branch boundary as the operation.
alter table public.audit_logs add column if not exists branch_id uuid references public.branches(id);
create index if not exists audit_logs_company_branch_created_idx on public.audit_logs(company_id,branch_id,created_at desc);
drop policy if exists "ARKAN audit logs read" on public.audit_logs;
drop policy if exists "ARKAN audit logs insert" on public.audit_logs;
create policy "ARKAN audit logs read" on public.audit_logs
for select to authenticated using (
  user_id=(select auth.uid())
  or (
    company_id is not null
    and (
      (branch_id is null and public.has_company_role(company_id,array['owner','admin','manager']))
      or (branch_id is not null and public.can_access_branch(company_id,branch_id))
    )
  )
);
create policy "ARKAN audit logs insert" on public.audit_logs
for insert to authenticated with check (
  user_id=(select auth.uid())
  and company_id is not null
  and public.is_company_member(company_id)
  and (branch_id is null or public.can_access_branch(company_id,branch_id))
);
