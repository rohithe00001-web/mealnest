import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Razorpay webhook receiver. Verifies the HMAC signature using
 * RAZORPAY_WEBHOOK_SECRET, then updates order payment status as a safety net
 * in case the browser callback was lost (closed tab, network drop, etc).
 *
 * Configure in Razorpay Dashboard → Settings → Webhooks with events:
 *   payment.captured, payment.failed, order.paid
 */
export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) {
          console.error("RAZORPAY_WEBHOOK_SECRET not set");
          return new Response("Not configured", { status: 500 });
        }

        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const body = await request.text();

        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event: string = payload?.event ?? "";
        const paymentEntity = payload?.payload?.payment?.entity;
        const orderEntity = payload?.payload?.order?.entity;
        const razorpayOrderId: string | undefined = paymentEntity?.order_id ?? orderEntity?.id;
        const razorpayPaymentId: string | undefined = paymentEntity?.id;

        if (!razorpayOrderId) {
          return new Response("No order id", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (event === "payment.captured" || event === "order.paid") {
          await supabaseAdmin
            .from("orders")
            .update({
              payment_status: "paid",
              razorpay_payment_id: razorpayPaymentId ?? null,
            })
            .eq("razorpay_order_id", razorpayOrderId)
            .neq("payment_status", "paid");
        } else if (event === "payment.failed") {
          await supabaseAdmin
            .from("orders")
            .update({ payment_status: "failed" })
            .eq("razorpay_order_id", razorpayOrderId)
            .eq("payment_status", "pending");
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
