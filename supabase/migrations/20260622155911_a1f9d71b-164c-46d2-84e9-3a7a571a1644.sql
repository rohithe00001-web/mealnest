
CREATE POLICY "Anyone can read seller branding"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'seller-branding');

CREATE POLICY "Sellers upload to own branding folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'seller-branding'
  AND EXISTS (
    SELECT 1 FROM public.sellers s
    WHERE s.user_id = auth.uid()
      AND (storage.foldername(name))[1] = s.id::text
  )
);

CREATE POLICY "Sellers update own branding"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'seller-branding'
  AND EXISTS (
    SELECT 1 FROM public.sellers s
    WHERE s.user_id = auth.uid()
      AND (storage.foldername(name))[1] = s.id::text
  )
);

CREATE POLICY "Sellers delete own branding"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'seller-branding'
  AND EXISTS (
    SELECT 1 FROM public.sellers s
    WHERE s.user_id = auth.uid()
      AND (storage.foldername(name))[1] = s.id::text
  )
);
