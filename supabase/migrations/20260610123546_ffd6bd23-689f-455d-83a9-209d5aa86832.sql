
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

CREATE OR REPLACE FUNCTION public.refresh_dish_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_dish uuid;
BEGIN
  target_dish := COALESCE(NEW.dish_id, OLD.dish_id);
  IF target_dish IS NOT NULL THEN
    UPDATE public.dishes d SET
      rating_avg = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM public.reviews WHERE dish_id = target_dish), 0),
      rating_count = (SELECT COUNT(*) FROM public.reviews WHERE dish_id = target_dish)
    WHERE d.id = target_dish;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_reviews_refresh_rating ON public.reviews;
CREATE TRIGGER trg_reviews_refresh_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.refresh_dish_rating();

CREATE POLICY "Sellers upload own dish images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dish-images'
    AND EXISTS (SELECT 1 FROM public.sellers s WHERE s.user_id = auth.uid() AND s.id::text = split_part(name, '/', 1))
  );

CREATE POLICY "Sellers update own dish images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dish-images'
    AND EXISTS (SELECT 1 FROM public.sellers s WHERE s.user_id = auth.uid() AND s.id::text = split_part(name, '/', 1))
  );

CREATE POLICY "Sellers delete own dish images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'dish-images'
    AND EXISTS (SELECT 1 FROM public.sellers s WHERE s.user_id = auth.uid() AND s.id::text = split_part(name, '/', 1))
  );

CREATE POLICY "Authenticated read dish images"
  ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'dish-images');
