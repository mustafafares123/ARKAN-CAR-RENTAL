-- Ensure every newly bootstrapped ARKAN company has a default branch.
create or replace function public.create_or_get_my_company(company_name text default 'ARKAN CO. – RENT A CAR')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare current_company uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select cm.company_id into current_company
  from public.company_members cm
  where cm.user_id=(select auth.uid())
  order by cm.company_id limit 1;
  if current_company is null then
    insert into public.companies(name)
    values(coalesce(nullif(trim(company_name),''),'ARKAN CO. – RENT A CAR'))
    returning id into current_company;
    insert into public.company_members(company_id,user_id,role)
    values(current_company,(select auth.uid()),'owner')
    on conflict(company_id,user_id) do nothing;
  end if;
  insert into public.branches(company_id,name,code,is_active,is_default)
  values(current_company,'المقر الرئيسي','MAIN',true,true)
  on conflict(company_id,code) do nothing;
  return current_company;
end;
$$;
revoke all on function public.create_or_get_my_company(text) from PUBLIC, anon;
grant execute on function public.create_or_get_my_company(text) to authenticated;
