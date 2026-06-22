
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS story text,
  ADD COLUMN IF NOT EXISTS cuisines text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS prep_time_min_avg integer NOT NULL DEFAULT 45;

DO $$ BEGIN
  CREATE TYPE public.dish_badge AS ENUM ('best_seller','chef_special','recommended','new');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS badge public.dish_badge,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- Backfill slugs for existing sellers
UPDATE public.sellers
SET slug = lower(regexp_replace(kitchen_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 6)
WHERE slug IS NULL;
