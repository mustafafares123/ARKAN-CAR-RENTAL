-- ARKAN Enterprise Phase 1: approval workflow and Auto Pilot findings foundation.
-- Additive only: preserves all existing tables and records.

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  request_type text not null check (request_type in ('discount','contract_cancellation','large_expense','record_deletion','financial_adjustment','other')),
  entity_type text,
  entity_id uuid,
  reason text not null check (length(trim(reason)) > 0),
  proposed_changes jsonb not null default '{}'::jsonb,
  amount numeric(14,2),
  currency text not null default 'ILS',
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decision_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists approval_requests_company_status_created_idx on public.approval_requests(company_id,status,created_at desc);
create index if not exists approval_requests_branch_created_idx on public.approval_requests(branch_id,created_at desc);
create index if not exists approval_requests_requester_created_idx on public.approval_requests(requested_by,created_at desc);
alter table public.approval_requests enable row level security;
grant select,insert,update on public.approval_requests to authenticated;

create policy "approval_requests_company_read" on public.approval_requests for select to authenticated
using (exists (select 1 from public.company_members cm where cm.company_id=approval_requests.company_id and cm.user_id=(select auth.uid())));

create policy "approval_requests_member_create" on public.approval_requests for insert to authenticated
with check (
 requested_by=(select auth.uid()) and status='pending' and reviewed_by is null
 and exists (select 1 from public.company_members cm where cm.company_id=approval_requests.company_id and cm.user_id=(select auth.uid()))
 and exists (select 1 from public.branches b where b.id=approval_requests.branch_id and b.company_id=approval_requests.company_id and b.is_active=true)
);

create policy "approval_requests_owner_review" on public.approval_requests for update to authenticated
using (status='pending' and exists (select 1 from public.company_members cm where cm.company_id=approval_requests.company_id and cm.user_id=(select auth.uid()) and cm.role in ('owner','admin')))
with check (
 reviewed_by=(select auth.uid()) and status in ('approved','rejected') and reviewed_at is not null
 and exists (select 1 from public.company_members cm where cm.company_id=approval_requests.company_id and cm.user_id=(select auth.uid()) and cm.role in ('owner','admin'))
);

create table if not exists public.autopilot_findings (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete set null,
 finding_type text not null,
 severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
 title text not null,
 description text not null,
 recommendation text not null,
 evidence jsonb not null default '{}'::jsonb,
 fingerprint text not null,
 status text not null default 'open' check (status in ('open','acknowledged','resolved','dismissed')),
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 resolved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists autopilot_findings_dedupe_idx on public.autopilot_findings(company_id,coalesce(branch_id,'00000000-0000-0000-0000-000000000000'::uuid),fingerprint);
create index if not exists autopilot_findings_company_status_severity_idx on public.autopilot_findings(company_id,status,severity,last_seen_at desc);
alter table public.autopilot_findings enable row level security;
grant select,update on public.autopilot_findings to authenticated;

create policy "autopilot_findings_management_read" on public.autopilot_findings for select to authenticated
using (exists (select 1 from public.company_members cm where cm.company_id=autopilot_findings.company_id and cm.user_id=(select auth.uid()) and cm.role in ('owner','admin','manager','accountant')));

create policy "autopilot_findings_management_update" on public.autopilot_findings for update to authenticated
using (status in ('open','acknowledged') and exists (select 1 from public.company_members cm where cm.company_id=autopilot_findings.company_id and cm.user_id=(select auth.uid()) and cm.role in ('owner','admin','manager')))
with check (status in ('acknowledged','resolved','dismissed') and exists (select 1 from public.company_members cm where cm.company_id=autopilot_findings.company_id and cm.user_id=(select auth.uid()) and cm.role in ('owner','admin','manager')));
