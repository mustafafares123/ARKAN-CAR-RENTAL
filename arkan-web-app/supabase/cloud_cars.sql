-- ARKAN cloud cars: company bootstrap, vehicle fields and private photo storage.
-- Run once in Supabase SQL Editor after supabase/schema.sql.
create extension if not exists pgcrypto;

create or replace function public.create_or_get_my_company(company_name text default 'ARKAN CO. – RENT A CAR')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_company uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select cm.company_id into current_company
  from public.company_members cm
  where cm.user_id = auth.uid()
  order by cm.company_id
  limit 1;

  if current_company is not null then
    return current_company;
  end if;

  insert into public.companies(name)
  values (coalesce(nullif(trim(company_name), ''), 'ARKAN CO. – RENT A CAR'))
  returning id into current_company;

  insert into public.company_members(company_id, user_id, role)
  values (current_company, auth.uid(), 'owner')
  on conflict (company_id, user_id) do nothing;

  return current_company;
end;
$$;

revoke all on function public.create_or_get_my_company(text) from public;
grant execute on function public.create_or_get_my_company(text) to authenticated;

alter table public.cars
  add column if not exists image_path text,
  add column if not exists color text,
  add column if not exists fuel_type text,
  add column if not exists transmission text;

create index if not exists cars_company_plate_idx on public.cars(company_id, plate);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('arkan-private','arkan-private',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_company_member(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = target_company and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_company_member(uuid) from public;
grant execute on function public.is_company_member(uuid) to authenticated;

drop policy if exists "ARKAN members read vehicle photos" on storage.objects;
create policy "ARKAN members read vehicle photos" on storage.objects
for select to authenticated
using (
  bucket_id = 'arkan-private'
  and public.is_company_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "ARKAN members upload vehicle photos" on storage.objects;
create policy "ARKAN members upload vehicle photos" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'arkan-private'
  and public.is_company_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "ARKAN members update vehicle photos" on storage.objects;
create policy "ARKAN members update vehicle photos" on storage.objects
for update to authenticated
using (
  bucket_id = 'arkan-private'
  and public.is_company_member((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'arkan-private'
  and public.is_company_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "ARKAN managers delete vehicle photos" on storage.objects;
create policy "ARKAN managers delete vehicle photos" on storage.objects
for delete to authenticated
using (
  bucket_id = 'arkan-private'
  and exists (
    select 1 from public.company_members m
    where m.company_id = (storage.foldername(name))[1]::uuid
      and m.user_id = auth.uid()
      and m.role in ('owner','admin','manager')
  )
);

-- Keep the bucket private. Do not add a service_role key to browser env vars.
