-- Enforce immutable approval evidence and Auto Pilot finding evidence for client users.
-- Service-side workers (auth.uid() is null) may maintain generated findings.

create or replace function public.guard_approval_request_review()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if old.status <> 'pending' then raise exception 'Only pending approval requests can be reviewed'; end if;
  if new.id is distinct from old.id
     or new.company_id is distinct from old.company_id
     or new.branch_id is distinct from old.branch_id
     or new.requested_by is distinct from old.requested_by
     or new.request_type is distinct from old.request_type
     or new.entity_type is distinct from old.entity_type
     or new.entity_id is distinct from old.entity_id
     or new.reason is distinct from old.reason
     or new.proposed_changes is distinct from old.proposed_changes
     or new.amount is distinct from old.amount
     or new.currency is distinct from old.currency
     or new.created_at is distinct from old.created_at then
    raise exception 'Approval request details are immutable after submission';
  end if;
  if new.status not in ('approved','rejected')
     or new.reviewed_by is distinct from auth.uid()
     or new.reviewed_at is null then
    raise exception 'A valid owner/admin decision is required';
  end if;
  return new;
end;
$$;
drop trigger if exists approval_requests_guard_review on public.approval_requests;
create trigger approval_requests_guard_review before update on public.approval_requests
for each row execute function public.guard_approval_request_review();

create or replace function public.guard_autopilot_finding_review()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if new.id is distinct from old.id
     or new.company_id is distinct from old.company_id
     or new.branch_id is distinct from old.branch_id
     or new.finding_type is distinct from old.finding_type
     or new.severity is distinct from old.severity
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.recommendation is distinct from old.recommendation
     or new.evidence is distinct from old.evidence
     or new.fingerprint is distinct from old.fingerprint
     or new.first_seen_at is distinct from old.first_seen_at
     or new.last_seen_at is distinct from old.last_seen_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Auto Pilot finding evidence is immutable to client users';
  end if;
  if new.status not in ('acknowledged','resolved','dismissed') then
    raise exception 'Invalid Auto Pilot finding transition';
  end if;
  if new.status = 'resolved' and new.resolved_at is null then
    raise exception 'Resolved findings require a resolution timestamp';
  end if;
  return new;
end;
$$;
drop trigger if exists autopilot_findings_guard_review on public.autopilot_findings;
create trigger autopilot_findings_guard_review before update on public.autopilot_findings
for each row execute function public.guard_autopilot_finding_review();
