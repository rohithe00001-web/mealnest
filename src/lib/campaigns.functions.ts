import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CampaignInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(["festival", "happy_hour", "flash_sale", "combo", "family_plan", "corporate", "weather"]),
  banner_image: z.string().optional().nullable(),
  config: z.record(z.string(), z.any()).default({}),
  discount_type: z.enum(["flat", "percent", "free_delivery", "combo_price"]).optional().nullable(),
  discount_value: z.number().nonnegative().default(0),
  max_discount: z.number().nonnegative().optional().nullable(),
  min_order: z.number().nonnegative().default(0),
  starts_at: z.string(),
  ends_at: z.string().optional().nullable(),
  audience_limit: z.number().int().positive().optional().nullable(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

export const listActiveCampaigns = createServerFn({ method: "GET" })
  .handler(async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await sb
      .from("promotional_campaigns")
      .select("id, name, description, type, banner_image, config, discount_type, discount_value, min_order, max_discount, ends_at, featured, seller_id, scope")
      .eq("active", true)
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .order("featured", { ascending: false })
      .order("starts_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("promotional_campaigns").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CampaignInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const row = { ...data, scope: "platform", seller_id: null, created_by: context.userId };
    if (data.id) {
      const { error } = await context.supabase.from("promotional_campaigns").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("promotional_campaigns").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const adminToggleCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("promotional_campaigns").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("promotional_campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sellerListCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: seller } = await context.supabase.from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");
    const { data, error } = await context.supabase
      .from("promotional_campaigns").select("*").eq("seller_id", seller.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const sellerUpsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CampaignInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: seller } = await context.supabase.from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");
    const row = { ...data, scope: "seller", seller_id: seller.id, featured: false, created_by: context.userId };
    if (data.id) {
      const { error } = await context.supabase
        .from("promotional_campaigns").update(row).eq("id", data.id).eq("seller_id", seller.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("promotional_campaigns").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const sellerToggleCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: seller } = await context.supabase.from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");
    const { error } = await context.supabase
      .from("promotional_campaigns").update({ active: data.active })
      .eq("id", data.id).eq("seller_id", seller.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const corporateBulkQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ employees: z.number().int().min(5), avgMealPrice: z.number().positive() }).parse(i)
  )
  .handler(async ({ data }) => {
    const tier = data.employees >= 200 ? 0.25 : data.employees >= 50 ? 0.18 : 0.12;
    const monthly = Math.round(data.employees * 22 * data.avgMealPrice);
    const discount = Math.round(monthly * tier);
    return { monthly, discount, payable: monthly - discount, discountPct: Math.round(tier * 100) };
  });