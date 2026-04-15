-- Add FK constraints: <table>.tenant_id -> clients.tenant_id
-- clients.tenant_id already has a UNIQUE constraint (clients_tenant_id_key).
-- ON UPDATE CASCADE keeps tenant renames consistent.
-- ON DELETE RESTRICT prevents dropping a tenant while it still has data.
-- Only covers tables whose tenant_id column is NOT NULL or always populated
-- by the application; if any row has NULL tenant_id, the NOT VALID clause
-- lets us add the constraint and validate afterwards.

do $$
declare
    tables text[] := array[
        'access_logs','app_content','archive_clients','archive_finances',
        'archive_packages','archive_passengers','archive_routes','audit_logs',
        'bookings','calendar','change_logs','client_app_access','client_ratings',
        'clients_directory','dispatches','distribution_template','expenses',
        'financial_summary','messages','notifications','orders','owner_account',
        'package_photos','packages','passenger_client_addresses',
        'passenger_route_points','passenger_route_prices','passengers',
        'password_resets','payments','profit_distribution','reviews',
        'route_access','routes','seating','staff','system_settings','users',
        'vehicles'
    ];
    t text;
    fk_name text;
begin
    foreach t in array tables loop
        fk_name := t || '_tenant_id_fkey';
        -- drop if present (idempotent)
        execute format(
            'alter table public.%I drop constraint if exists %I',
            t, fk_name
        );
        -- add FK, not valid first so existing rows don't block us
        execute format(
            'alter table public.%I add constraint %I ' ||
            'foreign key (tenant_id) references public.clients(tenant_id) ' ||
            'on update cascade on delete restrict not valid',
            t, fk_name
        );
        -- validate (will fail loudly on orphan rows)
        execute format(
            'alter table public.%I validate constraint %I',
            t, fk_name
        );
    end loop;
end $$;
