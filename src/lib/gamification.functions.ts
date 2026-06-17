import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

export const getGamificationState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const [
      { data: achievements },
      { data: unlocked },
      { data: spinToday },
      { data: mystery },
      { data: account },
      { data: refs },
    ] = await Promise.all([
      supabase.from("achievements").select("*").eq("active", true).order("threshold"),
      supabase.from("user_achievements").select("*").eq("user_id", userId),
      supabase.from("spin_wheel_spins").select("*").eq("user_id", userId).eq("spin_date", today).maybeSingle(),
      supabase.from("mystery_rewards").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("loyalty_accounts").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("referrals").select("id").eq("referrer_id", userId).eq("status", "rewarded"),
    ]);
    // auto-unlock any newly-met achievements
    const have = new Set((unlocked ?? []).map((u: any) => u.achievement_id));
    const ach = account ?? { total_orders: 0, current_streak: 0 };
    const refsCount = refs?.length ?? 0;
    const toUnlock: string[] = [];
    for (const a of achievements ?? []) {
      if (have.has(a.id)) continue;
      const v = a.metric === "orders" ? ach.total_orders
              : a.metric === "streak" ? ach.current_streak
              : a.metric === "referrals" ? refsCount : 0;
      if (v >= a.threshold) toUnlock.push(a.id);
    }
    if (toUnlock.length > 0) {
      await supabase.from("user_achievements").insert(toUnlock.map((id) => ({ user_id: userId, achievement_id: id })));
    }
    const { data: unlockedFinal } = await supabase.from("user_achievements").select("*").eq("user_id", userId);
    return {
      achievements: achievements ?? [],
      unlocked: unlockedFinal ?? [],
      spinToday: spinToday ?? null,
      mysteryRewards: mystery ?? [],
      nextMysteryAt: 10 - ((ach.total_orders ?? 0) % 10),
    };
  });

export const spinWheel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase.rpc("spin_wheel", { _user: context.userId });
    if (error) throw new Error(error.message);
    const row: any = Array.isArray(rows) ? rows[0] : rows;
    return {
      prizeKind: row.prize_kind as string,
      prizeValue: Number(row.prize_value),
      couponCode: (row.coupon_code ?? null) as string | null,
      reason: (row.reason ?? "") as string,
    };
  });

export const claimMysteryReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("claim_mystery_reward", {
      _user: context.userId, _id: data.id,
    });
    if (error) throw new Error(error.message);
    const row: any = Array.isArray(rows) ? rows[0] : rows;
    if (!row.success) throw new Error(row.reason ?? "Could not claim");
    return {
      couponCode: (row.coupon_code ?? null) as string | null,
      prizeKind: row.prize_kind as string,
      prizeValue: Number(row.prize_value),
    };
  });

// Admin: sponsorships + analytics
const SponsorshipInput = z.object({
  seller_id: z.string().uuid(),
  kind: z.enum(["new_boost", "featured", "top_rated"]),
  ends_at: z.string().optional().nullable(),
});

export const adminListSponsorships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("seller_sponsorships")
      .select("*, sellers(kitchen_name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminGrantSponsorship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SponsorshipInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("seller_sponsorships").insert({
      ...data, created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminToggleSponsorship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("seller_sponsorships").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminPromoAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [{ data: coupons }, { data: redemptions }, { data: campaigns }, { data: spins }, { data: mystery }] = await Promise.all([
      context.supabase.from("coupons").select("id, code, usage_count, scope"),
      context.supabase.from("coupon_redemptions").select("discount_amount, order_total, redeemed_at"),
      context.supabase.from("promotional_campaigns").select("id, name, type, used_count, active"),
      context.supabase.from("spin_wheel_spins").select("prize_kind, prize_value, spin_date"),
      context.supabase.from("mystery_rewards").select("prize_kind, claimed"),
    ]);
    const totalDiscount = (redemptions ?? []).reduce((s: number, r: any) => s + Number(r.discount_amount), 0);
    const totalRevenue = (redemptions ?? []).reduce((s: number, r: any) => s + Number(r.order_total), 0);
    const spinsToday = (spins ?? []).filter((s: any) => s.spin_date === new Date().toISOString().slice(0, 10)).length;
    const mysteryClaimRate = mystery && mystery.length > 0
      ? Math.round(((mystery ?? []).filter((m: any) => m.claimed).length / mystery.length) * 100)
      : 0;
    return {
      coupons: coupons ?? [],
      campaigns: campaigns ?? [],
      totalDiscount, totalRevenue,
      redemptionsCount: redemptions?.length ?? 0,
      spinsTotal: spins?.length ?? 0,
      spinsToday,
      mysteryTotal: mystery?.length ?? 0,
      mysteryClaimRate,
    };
  });