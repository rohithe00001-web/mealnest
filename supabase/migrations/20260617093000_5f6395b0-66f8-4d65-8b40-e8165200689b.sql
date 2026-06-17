ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_assignments;
ALTER TABLE public.delivery_assignments REPLICA IDENTITY FULL;