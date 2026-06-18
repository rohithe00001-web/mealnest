
-- Phone fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS country_code text DEFAULT '+91',
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS login_method text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
  ON public.profiles ((country_code || phone)) WHERE phone IS NOT NULL;

-- OTP codes table
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'login', -- login | phone_change
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.otp_codes TO service_role;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- Only service role accesses (via server fns). No client policies.

CREATE INDEX IF NOT EXISTS otp_codes_phone_created_idx
  ON public.otp_codes (phone_e164, created_at DESC);

-- Rate-limit table reuse: log otp_send attempts in reward_claim_attempts? No — separate.
CREATE TABLE IF NOT EXISTS public.otp_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL,
  ip text,
  channel text NOT NULL DEFAULT 'sms',
  success boolean NOT NULL DEFAULT true,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.otp_send_log TO service_role;
ALTER TABLE public.otp_send_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS otp_send_log_phone_created_idx
  ON public.otp_send_log (phone_e164, created_at DESC);
