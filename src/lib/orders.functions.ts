import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PlaceOrderInput = z.object({
  sellerId: z.string().uuid(),
  items: z
    .array(
      z.object({
        dishId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
      }),
    )
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
  paymentMethod: z.enum(["cod"]).default("cod"),
  couponCode: z.string().min(2).max(40).optional(),
});

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlaceOrderInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch dishes from DB to compute trusted pricing
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
        _order_id: null,
        _subscription_id: null,
        _kind: "order",
      });
      if (rErr) throw new Error(rErr.message);
      const r: any = Array.isArray(rRows) ? rRows[0] : rRows;
      if (!r?.success) throw new Error(r?.reason || "Invalid coupon");
      if (r.discount_type === "free_delivery") {
        deliveryFee = 0;
      } else if (r.discount_type === "partial_delivery") {
        deliveryFee = Math.max(0, deliveryFee - Number(r.discount));
      } else {
        discount = Number(r.discount);
      }
      couponCode = data.couponCode.toUpperCase();
      const { data: c } = await supabase.from("coupons").select("id").eq("code", couponCode).maybeSingle();
      couponId = c?.id ?? null;
    }
    const total = Math.max(0, subtotal + deliveryFee - discount);

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
        payment_method: data.paymentMethod,
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
      await supabase.from("coupon_redemptions").update({ order_id: order.id })
        .eq("coupon_id", couponId).eq("user_id", userId).is("order_id", null);
    }

    const { error: iErr } = await supabase
      .from("order_items")
      .insert(lineItems.map((li) => ({ ...li, order_id: order.id })));
    if (iErr) throw new Error(iErr.message);

    return { orderId: order.id, orderNumber: order.order_number, total: Number(order.total) };
  });
