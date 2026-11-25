-- Tighten and streamline customer portal RLS.
drop policy if exists "company admins manage portal links" on public.customer_portal_links;
drop policy if exists "customers read own portal link" on public.customer_portal_links;
create policy "company admins and customers read portal links" on public.customer_portal_links
for select to authenticated using (
  public.has_company_role(company_id,array['owner','admin','manager'])
  or user_id=(select auth.uid())
);
create policy "company admins insert portal links" on public.customer_portal_links
for insert to authenticated with check (public.has_company_role(company_id,array['owner','admin','manager']));
create policy "company admins update portal links" on public.customer_portal_links
for update to authenticated using (public.has_company_role(company_id,array['owner','admin','manager']))
with check (public.has_company_role(company_id,array['owner','admin','manager']));
create policy "company admins delete portal links" on public.customer_portal_links
for delete to authenticated using (public.has_company_role(company_id,array['owner','admin','manager']));
revoke execute on function public.customer_portal_my_status() from PUBLIC, anon;
grant execute on function public.customer_portal_my_status() to authenticated;
