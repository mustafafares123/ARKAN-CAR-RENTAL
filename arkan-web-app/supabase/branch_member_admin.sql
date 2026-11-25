-- ARKAN branch member administration.
-- Only company owners and admins may resolve Auth users by email or assign branches.
create or replace function public.list_branch_members(target_company uuid, target_branch uuid)
returns table(user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.has_company_role(target_company, array['owner','admin']) then
    raise exception 'Only company owners and admins can list branch members';
  end if;
  if not exists (select 1 from public.branches b where b.id=target_branch and b.company_id=target_company) then
    raise exception 'Branch does not belong to this company';
  end if;
  return query
    select bm.user_id, u.email::text, bm.role, bm.created_at
    from public.branch_members bm
    join auth.users u on u.id=bm.user_id
    where bm.company_id=target_company and bm.branch_id=target_branch
    order by bm.created_at desc;
end;
$$;

create or replace function public.assign_branch_member_by_email(target_company uuid, target_branch uuid, target_email text, target_role text default 'staff')
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare target_user uuid;
begin
  if auth.uid() is null or not public.has_company_role(target_company, array['owner','admin']) then
    raise exception 'Only company owners and admins can assign branch members';
  end if;
  if target_role not in ('manager','staff','accountant','viewer') then
    raise exception 'Invalid branch role';
  end if;
  if not exists (select 1 from public.branches b where b.id=target_branch and b.company_id=target_company) then
    raise exception 'Branch does not belong to this company';
  end if;
  select u.id into target_user from auth.users u
  where lower(u.email)=lower(trim(target_email)) and u.deleted_at is null
  limit 1;
  if target_user is null then
    raise exception 'No registered ARKAN user was found with this email';
  end if;
  insert into public.company_members(company_id,user_id,role)
  values(target_company,target_user,'staff')
  on conflict(company_id,user_id) do nothing;
  insert into public.branch_members(company_id,branch_id,user_id,role)
  values(target_company,target_branch,target_user,target_role)
  on conflict(branch_id,user_id) do update set role=excluded.role;
  return target_user;
end;
$$;

create or replace function public.remove_branch_member(target_company uuid, target_branch uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_company_role(target_company, array['owner','admin']) then
    raise exception 'Only company owners and admins can remove branch members';
  end if;
  delete from public.branch_members
  where company_id=target_company and branch_id=target_branch and user_id=target_user;
end;
$$;

revoke all on function public.list_branch_members(uuid,uuid) from PUBLIC, anon;
revoke all on function public.assign_branch_member_by_email(uuid,uuid,text,text) from PUBLIC, anon;
revoke all on function public.remove_branch_member(uuid,uuid,uuid) from PUBLIC, anon;
grant execute on function public.list_branch_members(uuid,uuid) to authenticated;
grant execute on function public.assign_branch_member_by_email(uuid,uuid,text,text) to authenticated;
grant execute on function public.remove_branch_member(uuid,uuid,uuid) to authenticated;
