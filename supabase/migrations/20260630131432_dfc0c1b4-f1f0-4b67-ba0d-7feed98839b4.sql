
-- Add new status value for "arrived at seller"
ALTER TYPE public.delivery_assignment_status ADD VALUE IF NOT EXISTS 'arrived_at_seller' BEFORE 'picked_up';

-- Drop OTP-related RPCs
DROP FUNCTION IF EXISTS public.validate_assignment_otp(uuid, text);
DROP FUNCTION IF EXISTS public.get_my_assignment_otp(uuid);

-- Drop OTP column
ALTER TABLE public.delivery_assignments DROP COLUMN IF EXISTS otp;
