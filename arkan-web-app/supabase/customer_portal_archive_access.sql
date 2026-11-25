-- Customer portal and private archive access.
-- Safe to re-run: policies are recreated with the same scoped predicates.
drop policy if exists "ARKAN customer self-request portal link" on public.customer_portal_links;
create policy "ARKAN customer self-request portal link"
on public.customer_portal_links
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and customer_id is null
  and not is_company_member(company_id)
);

drop policy if exists "ARKAN customer portal reads linked booking records" on public.arkan_records;
create policy "ARKAN customer portal reads linked booking records"
on public.arkan_records
for select
to authenticated
using (
  section in ('bookings', 'contracts')
  and exists (
    select 1
    from public.customer_portal_links l
    where l.company_id = arkan_records.company_id
      and l.user_id = (select auth.uid())
      and l.status = 'approved'
      and l.customer_id is not null
      and arkan_records.record_data ->> 'customer_id' = l.customer_id::text
  )
);

-- This public catalog RPC is not used by the current portal; keep its car/plate listing private.
revoke execute on function public.customer_portal_catalog() from public, anon, authenticated;

-- Keep the bucket private and preserve the current 10 MB limit.
-- Existing image types remain allowed; PDF and office document types are added for the archive.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'
]
where id = 'arkan-private';
