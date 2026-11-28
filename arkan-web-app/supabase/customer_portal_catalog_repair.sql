-- Repair the public ARKAN customer vehicle catalog.
create or replace function public.customer_portal_catalog()
returns table(id uuid, make text, model text, year integer, plate text, daily_rate numeric, currency text, status text, image_url text, color text, transmission text, fuel_type text, seats integer)
language sql stable security definer set search_path=public
as $function$
 select c.id, coalesce(c.make,c.brand), c.model, c.year,
        coalesce(c.plate,c.plate_number), coalesce(c.daily_rate,c.daily_price,0),
        'ILS'::text, c.status, coalesce(c.image_url,''), c.color,
        c.transmission, c.fuel_type, c.seats
 from public.cars c
 where c.company_id=(select m.company_id from public.company_members m
                     where m.role='owner' order by m.created_at desc limit 1)
   and lower(coalesce(c.status,'')) in ('available','متاحة')
 order by c.created_at desc;
$function$;
grant execute on function public.customer_portal_catalog() to anon, authenticated;
grant execute on function public.customer_portal_my_status() to authenticated;
notify pgrst, 'reload schema';
