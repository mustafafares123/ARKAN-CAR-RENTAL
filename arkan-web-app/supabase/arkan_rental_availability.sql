-- ARKAN database-level rental availability protection.
-- Apply after unified_cloud_records.sql and branch setup.
-- Additive and safe for existing rows; does not rewrite or delete data.
--
-- Protects both bookings and contracts, including concurrent requests from
-- multiple signed-in devices. Vehicle labels may contain plate and car number
-- separated by " - "; every token is used as a lock and matching identifier.

create or replace function public.enforce_arkan_vehicle_rental_availability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  new_start date;
  new_end date;
  new_car text;
  vehicle_token text;
  conflict_id uuid;
  conflict_section text;
  conflict_no text;
begin
  if new.section not in ('bookings','contracts') then
    return new;
  end if;

  if coalesce(lower(btrim(new.record_data->>'status')), '') in
     ('cancelled','canceled','ملغي','مرفوض','منتهي','returned','مكتمل','مغلق','rejected') then
    return new;
  end if;

  if coalesce(btrim(new.record_data->>'start_date'),'') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or coalesce(btrim(new.record_data->>'end_date'),'') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'A valid rental start and end date are required';
  end if;

  new_start := (new.record_data->>'start_date')::date;
  new_end := (new.record_data->>'end_date')::date;
  if new_end <= new_start then
    raise exception 'Rental end date must be after start date';
  end if;

  new_car := lower(btrim(coalesce(new.record_data->>'car_label','')));
  if new_car = '' then
    raise exception 'Select a registered vehicle before saving this rental';
  end if;

  -- Lock each identifier token in a stable order. This protects against
  -- concurrent saves even if one form uses plate and another uses car number.
  for vehicle_token in
    select distinct btrim(token)
    from regexp_split_to_table(new_car, '\s+-\s+') as parts(token)
    where btrim(token) <> ''
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(new.company_id::text || ':' || vehicle_token, 0));
  end loop;

  select r.id, r.section, coalesce(r.record_data->>'contract_no','')
    into conflict_id, conflict_section, conflict_no
  from public.arkan_records r
  where r.company_id = new.company_id
    and r.section in ('bookings','contracts')
    and r.id <> new.id
    and coalesce(lower(btrim(r.record_data->>'status')), '') not in
      ('cancelled','canceled','ملغي','مرفوض','منتهي','returned','مكتمل','مغلق','rejected')
    and coalesce(btrim(r.record_data->>'start_date'),'') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and coalesce(btrim(r.record_data->>'end_date'),'') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and (r.record_data->>'start_date')::date < new_end
    and (r.record_data->>'end_date')::date > new_start
    and exists (
      select 1
      from regexp_split_to_table(lower(btrim(coalesce(r.record_data->>'car_label',''))), '\s+-\s+') as old_token(token)
      where btrim(old_token.token) <> ''
        and btrim(old_token.token) in (
          select btrim(x)
          from regexp_split_to_table(new_car, '\s+-\s+') as new_token(x)
        )
    )
  limit 1;

  if conflict_id is not null then
    raise exception 'Vehicle is unavailable for the selected dates: an overlapping % record already exists (reference %)',
      conflict_section, coalesce(nullif(conflict_no,''), conflict_id::text)
      using errcode = '23P01';
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_arkan_vehicle_rental_availability() from public, anon, authenticated;

drop trigger if exists arkan_vehicle_rental_availability on public.arkan_records;
create trigger arkan_vehicle_rental_availability
before insert or update of section, company_id, record_data
on public.arkan_records
for each row
execute function public.enforce_arkan_vehicle_rental_availability();
