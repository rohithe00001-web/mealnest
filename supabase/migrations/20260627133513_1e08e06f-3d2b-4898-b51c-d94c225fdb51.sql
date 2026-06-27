-- Extend delivery_agents with full delivery-partner application fields
ALTER TABLE public.delivery_agents
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS residential_address text,
  ADD COLUMN IF NOT EXISTS rc_doc_url text,
  ADD COLUMN IF NOT EXISTS insurance_doc_url text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS upi_id text,
  ADD COLUMN IF NOT EXISTS preferred_areas text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS working_days text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS working_hours_start text,
  ADD COLUMN IF NOT EXISTS working_hours_end text,
  ADD COLUMN IF NOT EXISTS available_slots text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS seller_rejected_reason text,
  ADD COLUMN IF NOT EXISTS admin_rejected_reason text;

-- Grants: sensitive PII (aadhaar, license, bank, docs) stays revoked from "authenticated" SELECT.
-- Non-sensitive columns the applicant fills in are readable via existing per-row policies
-- ("agent reads own") but column-level SELECT must be explicitly granted to authenticated
-- because prior security migrations revoked broad SELECT.
GRANT SELECT (
  photo_url, date_of_birth, gender, residential_address,
  preferred_areas, working_days, working_hours_start, working_hours_end,
  available_slots, seller_rejected_reason, admin_rejected_reason
) ON public.delivery_agents TO authenticated;

-- Allow applicants to insert+update their own application across the new columns
GRANT INSERT, UPDATE (
  photo_url, date_of_birth, gender, residential_address,
  rc_doc_url, insurance_doc_url,
  bank_account_name, bank_name, bank_account_number, bank_ifsc, upi_id,
  preferred_areas, working_days, working_hours_start, working_hours_end, available_slots
) ON public.delivery_agents TO authenticated;

-- Service role keeps full access
GRANT ALL ON public.delivery_agents TO service_role;

-- Secure RPC: applicant can fetch their own full application (incl. sensitive cols)
CREATE OR REPLACE FUNCTION public.get_my_delivery_application()
RETURNS SETOF public.delivery_agents
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.delivery_agents WHERE user_id = auth.uid()
    ORDER BY created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_delivery_application() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_delivery_application() TO authenticated;

-- Seller-side RPC to read full application for agents tied to caller's kitchen
CREATE OR REPLACE FUNCTION public.seller_get_application(_agent_id uuid)
RETURNS SETOF public.delivery_agents
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.delivery_agents a
    JOIN public.sellers s ON s.id = a.seller_id
    WHERE a.id = _agent_id AND s.user_id = auth.uid()
  ) AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.delivery_agents WHERE id = _agent_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.seller_get_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_get_application(uuid) TO authenticated;