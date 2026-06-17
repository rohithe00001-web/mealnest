import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function randomCode(prefix: string) {
  const s = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${s}`;
}

export const getMyLoyalty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.rpc("ensure_loyalty_account", { _user: userId });
    const [{ data: account }, { data: txns }, { data: refCode }, { data: referrals }] = await Promise.all([
      supabase.from("loyalty_accounts").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("loyalty_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
      supabase.from("user_referral_codes").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("referrals").select("*").eq("referrer_id", userId).order("created_at", { ascending: false }),
    ]);
    return {
      account: account ?? { coins_balance: 0, lifetime_coins: 0, current_streak: 0, longest_streak: 0, total_orders: 0, last_order_date: null },
      transactions: txns ?? [],
      referralCode: refCode?.code ?? null,
      referrals: referrals ?? [],
    };
  });

export const generateReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase.from("user_referral_codes").select("code").eq("user_id", userId).maybeSingle();
    if (existing) return { code: existing.code };
    let code = randomCode("NEST");
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await supabase.from("user_referral_codes").select("code").eq("code", code).maybeSingle();
      if (!clash) break;
      code = randomCode("NEST");
    }
    const { error } = await supabase.from("user_referral_codes").insert({ user_id: userId, code });
    if (error) throw new Error(error.message);
    return { code };
  });

export const applyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ code: z.string().min(3).max(40) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("apply_referral_code", {
      _user: context.userId,
      _code: data.code.trim(),
    });
    if (error) throw new Error(error.message);
    const row: any = Array.isArray(rows) ? rows[0] : rows;
    if (!row?.success) throw new Error(row?.reason ?? "Could not apply code");
    return { ok: true };
  });

export const redeemCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ coins: z.number().int().min(100) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("redeem_coins_for_coupon", {
      _user: context.userId,
      _coins: data.coins,
    });
    if (error) throw new Error(error.message);
    const row: any = Array.isArray(rows) ? rows[0] : rows;
    if (!row?.success) throw new Error(row?.reason ?? "Could not redeem");
    return { code: row.code as string, discount: Number(row.discount) };
  });

export const updateBirthday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      dob: z.string().optional().nullable(),
      anniversary: z.string().optional().nullable(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ dob: data.dob || null, anniversary: data.anniversary || null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });