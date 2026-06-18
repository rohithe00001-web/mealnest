ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature text;

CREATE INDEX IF NOT EXISTS orders_razorpay_order_id_idx ON public.orders (razorpay_order_id);

-- Allow 'razorpay' as a valid payment_method (column is plain text — no enum change needed).
-- Webhook needs to look up orders by razorpay_order_id, which uses supabaseAdmin (service_role) and bypasses RLS.