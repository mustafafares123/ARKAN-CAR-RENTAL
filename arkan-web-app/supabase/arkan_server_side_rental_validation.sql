-- ARKAN server-side rental customer validation.
-- Apply after unified_cloud_records.sql, company_bootstrap_default_branch.sql,
-- and customer_compliance.sql. Safe/additive: existing records are not modified.
--
-- The current ARKAN UI stores bookings/contracts in arkan_records.record_data,
-- so triggers on the legacy bookings/contracts tables alone do not protect it.

create or replace function public.enforce_arkan_record_customer_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  linked_customer uuid;
begin
  if new.section not in ('bookings', 'contracts') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_company_member(new.company_id)
     or not public.can_access_branch(new.company_id, new.branch_id) then
    raise exception 'You are not authorized to create rental records for this branch';
  end if;

  begin
    linked_customer := nullif(btrim(new.record_data ->> 'customer_id'), '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'A valid registered customer must be linked to this rental';
  end;

  if linked_customer is null then
    raise exception 'A registered customer must be linked before saving a booking or contract';
  end if;

  perform public.assert_customer_eligible_for_rental(linked_customer, new.company_id);
  return new;
end;
$function$;

revoke all on function public.enforce_arkan_record_customer_eligibility() from public, anon, authenticated;

drop trigger if exists arkan_record_customer_eligibility on public.arkan_records;
create trigger arkan_record_customer_eligibility
before insert or update of section, company_id, branch_id, record_data
on public.arkan_records
for each row
execute function public.enforce_arkan_record_customer_eligibility();

comment on function public.enforce_arkan_record_customer_eligibility() is
'Server-side age, licence, identity-document and customer-link validation for ARKAN bookings/contracts stored in arkan_records.';
