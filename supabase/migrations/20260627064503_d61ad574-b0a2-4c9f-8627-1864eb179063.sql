
-- Public-safe SELECT (excludes phone, email, bank_details, food_license_url, id_proof_url)
GRANT SELECT (
  id, user_id, kitchen_name, description, cover_image_url, address_line, city, pincode,
  latitude, longitude, delivery_radius_km, business_hours, status, is_open,
  rating_avg, rating_count, created_at, updated_at,
  logo_url, banner_url, gallery, story, cuisines, specialties, slug, prep_time_min_avg
) ON public.sellers TO anon, authenticated;

-- Sellers can INSERT their own row (RLS enforces user_id = auth.uid())
GRANT INSERT (
  user_id, kitchen_name, description, cover_image_url, phone, email, address_line, city, pincode,
  latitude, longitude, delivery_radius_km, business_hours, food_license_url, id_proof_url,
  bank_details, is_open, logo_url, banner_url, gallery, story, cuisines, specialties, slug, prep_time_min_avg
) ON public.sellers TO authenticated;

-- Sellers can UPDATE storefront/operational fields (RLS still scopes to own row).
-- 'status' stays admin-only (no grant here).
GRANT UPDATE (
  kitchen_name, description, cover_image_url, phone, email, address_line, city, pincode,
  latitude, longitude, delivery_radius_km, business_hours, food_license_url, id_proof_url,
  bank_details, is_open, logo_url, banner_url, gallery, story, cuisines, specialties, slug, prep_time_min_avg
) ON public.sellers TO authenticated;

GRANT ALL ON public.sellers TO service_role;
