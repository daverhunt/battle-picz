grant select(id,display_name) on public.profiles to service_role;
grant select(id,seed) on public.matches to service_role;
grant select(id,status),update(status,locked_at,last_error) on public.notification_outbox to service_role;
