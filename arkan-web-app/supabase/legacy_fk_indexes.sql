-- Cover remaining legacy foreign keys identified by Supabase performance advisors.
create index if not exists customer_portal_links_customer_id_idx on public.customer_portal_links(customer_id);
create index if not exists customer_portal_links_reviewed_by_idx on public.customer_portal_links(reviewed_by);
create index if not exists inspections_booking_id_idx on public.inspections(booking_id);
create index if not exists inspections_car_id_idx on public.inspections(car_id);
