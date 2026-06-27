
-- Restore INSERT/UPDATE column grants for sellers (RLS still scopes rows to owner/admin)
-- Excludes: status (admin-only), rating_avg/rating_count (system), id/created_at/updated_at
GRANT INSERT (user_id, kitchen_name, description, cover_image_url, phone, email, address_line, city, pincode, latitude, longitude, delivery_radius_km, business_hours, food_license_url, id_proof_url, bank_details, is_open, logo_url, banner_url, gallery, story, cuisines, specialties, slug, prep_time_min_avg)
  ON public.sellers TO authenticated;

GRANT UPDATE (kitchen_name, description, cover_image_url, phone, email, address_line, city, pincode, latitude, longitude, delivery_radius_km, business_hours, food_license_url, id_proof_url, bank_details, is_open, logo_url, banner_url, gallery, story, cuisines, specialties, slug, prep_time_min_avg)
  ON public.sellers TO authenticated;

GRANT ALL ON public.sellers TO service_role;
