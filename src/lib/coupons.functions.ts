import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CouponInput = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(2).max(40).transform((s) => s.toUpperCase().trim()),
  description: z.string().max(300).optional().nullable(),
  scope: z.enum(["platform", "seller", "category"]).default("platform"),
  seller_id: z.string().uuid().optional().nullable(),
  discount_type: z.enum(["flat", "percent", "free_delivery", "partial_delivery"]),
  discount_flat: z.number().nonnegative().optional().nullable(),
  discount_percent: z.number().int().min(0).max(100).optional().nullable(),
  max_discount: z.number().nonnegative().optional().nullable(),
  min_order: z.number().nonnegative().default(0),
  usage_limit_total: z.number().int().positive().optional().nullable(),
  usage_limit_per_user: z.number().int().positive().default(1),
  starts_at: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  applies_to: z.enum(["order", "subscription", "both"]).default("order"),
  subscription_plan_types: z.array(z.string()).default([]),
  category_ids: z.array(z.string().uuid()).default([]),
  cuisine_tags: z.array(z.string()).default([]),
  geo_pincodes: z.array(z.string()).default([]),
  festival_tag: z.string().max(40).optional().nullable(),
  new_customers_only: z.boolean().default(false),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.any()).default({}),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

async function assertSellerOwns(supabase: any, userId: string, sellerId: string) {
  const { data } = await supabase.from("sellers").select("id, user_id").eq("id", sellerId).maybeSingle();
  if (!data || data.user_id !== userId) throw new Error("Not your kitchen");
}

export const adminListCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CouponInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const row = { ...data, created_by: context.userId };
    if (data.id) {
      const { error } = await context.supabase.from("coupons").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("coupons").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const adminToggleCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("coupons").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("coupons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sellerListCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: seller } = await context.supabase
      .from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");
    const { data, error } = await context.supabase
      .from("coupons").select("*").eq("seller_id", seller.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const sellerUpsertCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CouponInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: seller } = await context.supabase
      .from("sellers").select("id, user_id").eq("user_id", context.userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");
    const row = {
      ...data,
      scope: "seller" as const,
      seller_id: seller.id,
      created_by: context.userId,
    };
    if (data.id) {
      await assertSellerOwns(context.supabase, context.userId, seller.id);
      const { error } = await context.supabase.from("coupons").update(row).eq("id", data.id).eq("seller_id", seller.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("coupons").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const sellerToggleCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: seller } = await context.supabase
      .from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");
    const { error } = await context.supabase
      .from("coupons").update({ active: data.active })
      .eq("id", data.id).eq("seller_id", seller.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const previewCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      code: z.string().min(2).max(40),
      sellerId: z.string().uuid().optional().nullable(),
      orderTotal: z.number().nonnegative(),
      kind: z.enum(["order", "subscription"]).default("order"),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("validate_coupon", {
      _code: data.code,
      _user: context.userId,
      _seller: (data.sellerId ?? null) as any,
      _order_total: data.orderTotal,
      _kind: data.kind,
    });
    if (error) throw new Error(error.message);
    const row: any = Array.isArray(rows) ? rows[0] : rows;
    return {
      valid: !!row?.valid,
      discount: Number(row?.discount ?? 0),
      reason: (row?.reason ?? "") as string,
      couponId: (row?.coupon_id ?? null) as string | null,
      discountType: (row?.discount_type ?? null) as string | null,
    };
  });

export const sellerCouponAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: seller } = await context.supabase
      .from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");
    const { data: coupons } = await context.supabase
      .from("coupons").select("id, code, usage_count, usage_limit_total")
      .eq("seller_id", seller.id);
    const ids = (coupons ?? []).map((c: any) => c.id);
    let redemptions: any[] = [];
    if (ids.length) {
      const { data } = await context.supabase
        .from("coupon_redemptions")
        .select("coupon_id, discount_amount, order_total, redeemed_at")
        .in("coupon_id", ids);
      redemptions = data ?? [];
    }
    const totalDiscount = redemptions.reduce((s, r) => s + Number(r.discount_amount), 0);
    const totalRevenue = redemptions.reduce((s, r) => s + Number(r.order_total), 0);
    return { coupons: coupons ?? [], redemptions, totalDiscount, totalRevenue };
  });

export const adminCouponAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: coupons } = await context.supabase
      .from("coupons").select("id, code, scope, usage_count, discount_type");
    const { data: redemptions } = await context.supabase
      .from("coupon_redemptions").select("coupon_id, discount_amount, order_total, redeemed_at");
    const totalDiscount = (redemptions ?? []).reduce((s, r) => s + Number(r.discount_amount), 0);
    const totalRevenue = (redemptions ?? []).reduce((s, r) => s + Number(r.order_total), 0);
    return { coupons: coupons ?? [], redemptions: redemptions ?? [], totalDiscount, totalRevenue };
  });

/**
 * Returns coupons applicable to the user's current cart, grouped by scope,
 * with computed discount values + a "best" recommendation.
 */
export const listApplicableCoupons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      sellerId: z.string().uuid().optional().nullable(),
      orderTotal: z.number().nonnegative(),
      kind: z.enum(["order", "subscription"]).default("order"),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    // Use SECURITY DEFINER RPC that only returns customer-safe columns
    // (no usage_count, geo_pincodes, metadata, created_by, etc.).
    const { data: rows, error } = await context.supabase.rpc("list_active_coupons_safe", {
      _seller_id: (data.sellerId ?? null) as any,
    });
    if (error) throw new Error(error.message);

    const evaluated = await Promise.all(
      (rows ?? []).map(async (c: any) => {
        const { data: vRows } = await context.supabase.rpc("validate_coupon", {
          _code: c.code,
          _user: context.userId,
          _seller: (data.sellerId ?? null) as any,
          _order_total: data.orderTotal,
          _kind: data.kind,
        });
        const v: any = Array.isArray(vRows) ? vRows[0] : vRows;
        return {
          id: c.id,
          code: c.code,
          description: c.description,
          scope: c.scope,
          seller_id: c.seller_id,
          discount_type: c.discount_type,
          discount_flat: c.discount_flat,
          discount_percent: c.discount_percent,
          max_discount: c.max_discount,
          min_order: c.min_order,
          applies_to: c.applies_to,
          expires_at: c.expires_at,
          new_customers_only: c.new_customers_only,
          valid: !!v?.valid,
          reason: (v?.reason ?? "") as string,
          discount: Number(v?.discount ?? 0),
          // Approximate net value for ranking (free_delivery worth ~29)
          netValue:
            v?.valid
              ? c.discount_type === "free_delivery"
                ? 29
                : c.discount_type === "partial_delivery"
                  ? Number(c.discount_flat ?? 0)
                  : Number(v?.discount ?? 0)
              : 0,
        };
      })
    );

    const valid = evaluated.filter((c) => c.valid).sort((a, b) => b.netValue - a.netValue);
    const ineligible = evaluated.filter((c) => !c.valid);
    const best = valid[0] ?? null;

    return {
      best,
      seller: valid.filter((c) => c.scope === "seller"),
      platform: valid.filter((c) => c.scope === "platform" && c.applies_to !== "subscription"),
      subscription: valid.filter((c) => c.applies_to === "subscription" || c.applies_to === "both"),
      ineligible,
    };
  });

