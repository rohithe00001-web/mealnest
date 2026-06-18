import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateInput = z.object({
  sellerId: z.string().uuid(),
  items: z
    .array(z.object({ dishId: z.string().uuid(), quantity: z.number().int().min(1).max(50) }))
    .min(1)
    .max(30),
  deliveryAddress: z.object({
    label: z.string().min(1).max(40),
    addressLine: z.string().min(3).max(300),
    city: z.string().min(1).max(80),
    pincode: z.string().max(20).optional(),
    phone: z.string().min(5).max(20),
  }),
  deliveryInstructions: z.string().max(300).optional(),
  couponCode: z.string().min(2).max(40).optional(),
});

const VerifyInput = z.object({
  orderId: z.string().uuid(),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

/**
 * Creates a pending order in our DB and a corresponding Razorpay order.
 * Returns the keys needed to open the Razorpay Checkout modal client-side.
 */
export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Payments are not configured");

    const { supabase, userId } = context;

    // Trusted pricing from DB
    const dishIds = data.items.map((i) => i.dishId);
    const { data: dishes, error: dErr } = await supabase
      .from("dishes")
      .select("id, name, price, image_url, seller_id, is_available")
      .in("id", dishIds);
    if (dErr) throw new Error(dErr.message);
    if (!dishes || dishes.length !== dishIds.length) throw new Error("Some dishes are unavailable");

    for (const d of dishes) {
      if (d.seller_id !== data.sellerId) throw new Error("Cart contains dishes from a different kitchen");
      if (!d.is_available) throw new Error(`${d.name} is no longer available`);
    }

    const lineItems = data.items.map((it) => {
      const d = dishes.find((x) => x.id === it.dishId)!;
      return {
        dish_id: d.id,
        dish_name: d.name,
        dish_image_url: d.image_url,
        unit_price: Number(d.price),
        quantity: it.quantity,
        line_total: Number(d.price) * it.quantity,
      };
    });

    const subtotal = lineItems.reduce((n, x) => n + x.line_total, 0);
    let deliveryFee = subtotal >= 500 ? 0 : 29;
    let discount = 0;
    let couponId: string | null = null;
    let couponCode: string | null = null;

    if (data.couponCode) {
      const { data: rRows, error: rErr } = await supabase.rpc("redeem_coupon", {
        _code: data.couponCode,
        _user: userId,
        _seller: data.sellerId,
        _order_total: subtotal,
        _order_id: null as any,
        _subscription_id: null as any,
        _kind: "order",
      });
      if (rErr) throw new Error(rErr.message);
      const r: any = Array.isArray(rRows) ? rRows[0] : rRows;
      if (!r?.success) throw new Error(r?.reason || "Invalid coupon");
      if (r.discount_type === "free_delivery") deliveryFee = 0;
      else if (r.discount_type === "partial_delivery") deliveryFee = Math.max(0, deliveryFee - Number(r.discount));
      else discount = Number(r.discount);
      couponCode = data.couponCode.toUpperCase();
      const { data: c } = await supabase.from("coupons").select("id").eq("code", couponCode).maybeSingle();
      couponId = c?.id ?? null;
    }
    const total = Math.max(0, subtotal + deliveryFee - discount);
    const amountPaise = Math.round(total * 100);

    // Insert order as pending payment
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .insert({
        customer_id: userId,
        seller_id: data.sellerId,
        delivery_address: data.deliveryAddress,
        subtotal,
        delivery_fee: deliveryFee,
        discount,
        total,
        payment_method: "razorpay",
        payment_status: "pending",
        status: "placed",
        delivery_instructions: data.deliveryInstructions ?? null,
        coupon_id: couponId,
        coupon_code: couponCode,
      })
      .select("id, order_number, total")
      .single();
    if (oErr) throw new Error(oErr.message);

    if (couponId) {
      await supabase
        .from("coupon_redemptions")
        .update({ order_id: order.id })
        .eq("coupon_id", couponId)
        .eq("user_id", userId)
        .is("order_id", null);
    }

    const { error: iErr } = await supabase
      .from("order_items")
      .insert(lineItems.map((li) => ({ ...li, order_id: order.id })));
    if (iErr) throw new Error(iErr.message);

    // Create Razorpay order via REST API
    const auth = btoa(`${keyId}:${keySecret}`);
    const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: order.order_number ?? order.id,
        notes: { order_id: order.id, customer_id: userId },
      }),
    });
    if (!rpRes.ok) {
      const errText = await rpRes.text();
      console.error("Razorpay create order failed:", rpRes.status, errText);
      // Mark order as failed so it isn't reused
      await supabase.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
      throw new Error("Could not start payment. Please try again.");
    }
    const rpOrder = (await rpRes.json()) as { id: string };

    await supabase.from("orders").update({ razorpay_order_id: rpOrder.id }).eq("id", order.id);

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      amount: amountPaise,
      currency: "INR",
      keyId,
      razorpayOrderId: rpOrder.id,
    };
  });

/**
 * Verify the signature returned by the Razorpay Checkout modal and mark the order paid.
 */
export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VerifyInput.parse(input))
  .handler(async ({ data, context }) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error("Payments are not configured");

    const { createHmac, timingSafeEqual } = await import("crypto");
    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpayOrderId}|${data.razorpayPaymentId}`)
      .digest("hex");

    const sigBuf = Buffer.from(data.razorpaySignature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new Error("Invalid payment signature");
    }

    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        razorpay_payment_id: data.razorpayPaymentId,
        razorpay_signature: data.razorpaySignature,
      })
      .eq("id", data.orderId)
      .eq("customer_id", userId)
      .eq("razorpay_order_id", data.razorpayOrderId)
      .select("id, order_number")
      .single();
    if (error) throw new Error(error.message);

    return { orderId: order.id, orderNumber: order.order_number };
  });
