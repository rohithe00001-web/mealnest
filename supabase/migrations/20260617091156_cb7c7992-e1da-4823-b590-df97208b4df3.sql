
CREATE POLICY "agent uploads own docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agent-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "agent reads own docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'agent-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "seller reads agent docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'agent-docs' AND EXISTS (
    SELECT 1 FROM public.delivery_agents da
    JOIN public.sellers s ON s.id = da.seller_id
    WHERE s.user_id = auth.uid() AND da.user_id::text = (storage.foldername(name))[1]
  ));
CREATE POLICY "admin reads agent docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'agent-docs' AND public.has_role(auth.uid(),'admin'));
