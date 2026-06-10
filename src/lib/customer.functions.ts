import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============ ADDRESSES ============
const AddressInput = z.object({
  label: z.string().min(1).max(40),
  addressLine: z.string().min(3).max(300),
  city: z.string().min(1).max(80),
  pincode: z.string().max(20).optional().or(z.literal("")),
  isDefault: z.boolean().optional(),
});

export const listAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("addresses")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), data: AddressInput }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const payload = {
      user_id: context.userId,
      label: data.data.label,
      address_line: data.data.addressLine,
      city: data.data.city,
      pincode: data.data.pincode || null,
      is_default: !!data.data.isDefault,
    };
    if (data.data.isDefault) {
      await context.supabase.from("addresses").update({ is_default: false }).eq("user_id", context.userId);
    }
    if (data.id) {
      const { error } = await context.supabase.from("addresses").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase.from("addresses").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("addresses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ WISHLIST ============
export const listWishlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("wishlists")
      .select("id, dish_id, created_at, dishes(id, name, price, image_url, is_veg, rating_avg, seller_id, sellers(kitchen_name))")
      .not("dish_id", "is", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const toggleWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dishId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: existing } = await context.supabase
      .from("wishlists")
      .select("id")
      .eq("user_id", context.userId)
      .eq("dish_id", data.dishId)
      .maybeSingle();
    if (existing) {
      await context.supabase.from("wishlists").delete().eq("id", existing.id);
      return { wished: false };
    }
    const { error } = await context.supabase
      .from("wishlists")
      .insert({ user_id: context.userId, dish_id: data.dishId });
    if (error) throw new Error(error.message);
    return { wished: true };
  });

export const getWishlistIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("wishlists")
      .select("dish_id")
      .eq("user_id", context.userId)
      .not("dish_id", "is", null);
    return (data ?? []).map((r) => r.dish_id as string);
  });

// ============ REVIEWS ============
export const listDishReviews = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ dishId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("reviews")
      .select("id, rating, comment, seller_reply, created_at, customer_id")
      .eq("dish_id", data.dishId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.customer_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as any[] };
    const nameMap = new Map<string, string>();
    for (const p of profs ?? []) nameMap.set(p.id, p.full_name ?? "Customer");
    return (rows ?? []).map((r) => ({ ...r, customer_name: nameMap.get(r.customer_id) ?? "Customer" }));
  });

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        dishId: z.string().uuid(),
        sellerId: z.string().uuid(),
        orderId: z.string().uuid().optional(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(800).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: existing } = await context.supabase
      .from("reviews")
      .select("id")
      .eq("customer_id", context.userId)
      .eq("dish_id", data.dishId)
      .maybeSingle();
    if (existing) {
      const { error } = await context.supabase
        .from("reviews")
        .update({ rating: data.rating, comment: data.comment ?? null })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }
    const { data: row, error } = await context.supabase
      .from("reviews")
      .insert({
        customer_id: context.userId,
        seller_id: data.sellerId,
        dish_id: data.dishId,
        order_id: data.orderId ?? null,
        rating: data.rating,
        comment: data.comment ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getOrderDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("*, order_items(*), sellers(id, kitchen_name, city, phone)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return order;
  });
