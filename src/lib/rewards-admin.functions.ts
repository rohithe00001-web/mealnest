import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: any) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

async function logAudit(ctx: any, action: string, entity: string, id: string | null, prev: any, next: any) {
  await ctx.supabase.rpc("log_rewards_audit", {
    _admin: ctx.userId,
    _action: action,
    _entity_type: entity,
    _entity_id: id,
    _previous: prev ?? null,
    _new: next ?? null,
  });
}

// ----- Referral Campaigns -----
const ReferralCampaignSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  active: z.boolean().default(true),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
  referrer_reward_type: z.enum(["cash", "coupon", "coins", "free_delivery", "sub_discount"]),
  referrer_reward_value: z.number().min(0).max(100000),
  referred_reward_type: z.enum(["cash", "coupon", "coins", "free_delivery", "sub_discount"]),
  referred_reward_value: z.number().min(0).max(100000),
  min_order_amount: z.number().min(0).max(100000).default(0),
  max_uses_per_referrer: z.number().int().min(1).max(10000).default(50),
  reward_trigger: z.enum(["first_order", "payment", "subscription"]),
  expiry_days: z.number().int().min(1).max(3650).default(30),
  fraud_device_check: z.boolean().default(true),
  fraud_duplicate_account: z.boolean().default(true),
  fraud_multi_referral: z.boolean().default(true),
  fraud_ip_validation: z.boolean().default(true),
  fraud_self_block: z.boolean().default(true),
});

export const listReferralCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("referral_campaigns" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertReferralCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ReferralCampaignSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let prev: any = null;
    if (data.id) {
      const { data: existing } = await context.supabase.from("referral_campaigns" as any).select("*").eq("id", data.id).maybeSingle();
      prev = existing;
    }
    const payload = { ...data, created_by: data.id ? undefined : context.userId };
    const { data: row, error } = await context.supabase
      .from("referral_campaigns" as any)
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAudit(context, data.id ? "update" : "create", "referral_campaign", (row as any).id, prev, row);
    return row;
  });

export const toggleReferralCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("referral_campaigns" as any).update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, data.active ? "activate" : "deactivate", "referral_campaign", data.id, null, { active: data.active });
    return { ok: true };
  });

export const deleteReferralCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: prev } = await context.supabase.from("referral_campaigns" as any).select("*").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("referral_campaigns" as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "delete", "referral_campaign", data.id, prev, null);
    return { ok: true };
  });

// ----- Wheels -----
const WheelSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  scope: z.enum(["global", "seller", "campaign"]),
  seller_id: z.string().uuid().optional().nullable(),
  active: z.boolean().default(true),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
  spins_per_day: z.number().int().min(0).max(100).default(1),
  spins_per_week: z.number().int().min(0).max(700).default(7),
  spins_per_month: z.number().int().min(0).max(3000).default(30),
  require_login: z.boolean().default(true),
  require_order: z.boolean().default(false),
  require_subscription: z.boolean().default(false),
  require_referral: z.boolean().default(false),
  min_purchase_amount: z.number().min(0).max(1000000).default(0),
});

const SegmentSchema = z.object({
  id: z.string().uuid().optional(),
  wheel_id: z.string().uuid(),
  label: z.string().min(1),
  reward_type: z.enum(["cash_off", "percent_off", "free_delivery", "coins", "sub_discount", "free_food", "jackpot_coupon", "better_luck"]),
  reward_value: z.number().min(0).max(100000),
  coupon_min_order: z.number().min(0).max(1000000).default(0),
  coupon_max_discount: z.number().min(0).max(1000000).optional().nullable(),
  coupon_expires_days: z.number().int().min(1).max(365).default(14),
  coupon_stackable: z.boolean().default(false),
  applies_to: z.enum(["order", "subscription", "any"]).default("order"),
  probability_weight: z.number().min(0).max(100),
  active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  color: z.string().default("#f59e0b"),
});

export const listWheels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("mystery_wheels" as any)
      .select("*, sellers(kitchen_name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertWheel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => WheelSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let prev: any = null;
    if (data.id) {
      const { data: existing } = await context.supabase.from("mystery_wheels" as any).select("*").eq("id", data.id).maybeSingle();
      prev = existing;
    }
    const { data: row, error } = await context.supabase
      .from("mystery_wheels" as any)
      .upsert({ ...data, created_by: data.id ? undefined : context.userId }, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAudit(context, data.id ? "update" : "create", "mystery_wheel", (row as any).id, prev, row);
    return row;
  });

export const toggleWheel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.active) {
      const { data: rows } = await context.supabase.rpc("validate_wheel_probabilities", { _wheel: data.id });
      const row: any = Array.isArray(rows) ? rows[0] : rows;
      if (!row?.valid) throw new Error(row?.reason ?? "Probabilities must equal 100");
    }
    const { error } = await context.supabase.from("mystery_wheels" as any).update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, data.active ? "activate" : "deactivate", "mystery_wheel", data.id, null, { active: data.active });
    return { ok: true };
  });

export const deleteWheel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: prev } = await context.supabase.from("mystery_wheels" as any).select("*").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("mystery_wheels" as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "delete", "mystery_wheel", data.id, prev, null);
    return { ok: true };
  });

export const listSegments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ wheel_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: segs, error } = await context.supabase
      .from("mystery_wheel_segments" as any)
      .select("*")
      .eq("wheel_id", data.wheel_id)
      .order("sort_order");
    if (error) throw new Error(error.message);
    const { data: validRows } = await context.supabase.rpc("validate_wheel_probabilities", { _wheel: data.wheel_id });
    const v: any = Array.isArray(validRows) ? validRows[0] : validRows;
    return { segments: segs ?? [], probabilityTotal: Number(v?.total ?? 0), valid: !!v?.valid };
  });

export const upsertSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SegmentSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let prev: any = null;
    if (data.id) {
      const { data: existing } = await context.supabase.from("mystery_wheel_segments" as any).select("*").eq("id", data.id).maybeSingle();
      prev = existing;
    }
    const { data: row, error } = await context.supabase
      .from("mystery_wheel_segments" as any)
      .upsert(data, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await logAudit(context, data.id ? "update" : "create", "wheel_segment", (row as any).id, prev, row);
    return row;
  });

export const deleteSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: prev } = await context.supabase.from("mystery_wheel_segments" as any).select("*").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("mystery_wheel_segments" as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "delete", "wheel_segment", data.id, prev, null);
    return { ok: true };
  });

// ----- Analytics -----
export const getReferralAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [{ data: refs }, { data: campaigns }, { data: fraud }] = await Promise.all([
      context.supabase.from("referrals").select("status, created_at, campaign_id"),
      context.supabase.from("referral_campaigns" as any).select("id, name, active"),
      context.supabase.from("referral_fraud_events" as any).select("kind, created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    const total = refs?.length ?? 0;
    const successful = (refs ?? []).filter((r: any) => r.status === "rewarded").length;
    const conversion = total ? Math.round((successful / total) * 100) : 0;
    return {
      total,
      successful,
      conversion,
      campaigns: campaigns ?? [],
      fraudEvents: fraud ?? [],
    };
  });

export const getWheelAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: spins } = await context.supabase
      .from("spin_wheel_spins")
      .select("prize_kind, prize_value, segment_id, created_at, wheel_id");
    const total = spins?.length ?? 0;
    const cost = (spins ?? []).reduce((s: number, sp: any) => s + Number(sp.prize_value ?? 0), 0);
    const byPrize: Record<string, number> = {};
    for (const sp of spins ?? []) byPrize[(sp as any).prize_kind] = (byPrize[(sp as any).prize_kind] ?? 0) + 1;
    const topPrize = Object.entries(byPrize).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { total, cost, byPrize, topPrize };
  });

// ----- Audit -----
export const getAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("rewards_audit_log" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const adminIds = Array.from(new Set((data ?? []).map((d: any) => d.admin_id).filter(Boolean)));
    const profiles: Record<string, string> = {};
    if (adminIds.length) {
      const { data: pf } = await context.supabase.from("profiles").select("id, full_name").in("id", adminIds);
      for (const p of pf ?? []) profiles[(p as any).id] = (p as any).full_name ?? "";
    }
    return (data ?? []).map((d: any) => ({ ...d, admin_name: profiles[d.admin_id] ?? "Unknown" }));
  });
