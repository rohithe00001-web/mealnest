import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function clientIp(): string | null {
  try {
    const req = getRequest();
    const h = req?.headers;
    if (!h) return null;
    return (
      h.get("cf-connecting-ip") ||
      h.get("x-real-ip") ||
      (h.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
      null
    );
  } catch { return null; }
}

async function assertAdmin(ctx: any) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

// ---------- Public (auth-not-required) checks via service role wrapper ----------

const CheckSchema = z.object({
  fingerprint: z.string().min(8).max(200),
  role: z.enum(["customer", "seller", "delivery_agent"]).default("customer"),
  userAgent: z.string().max(500).optional(),
  platform: z.string().max(100).optional(),
});

export const checkDeviceForSignup = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CheckSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("register_device" as any, {
      _fingerprint: data.fingerprint,
      _ua: data.userAgent ?? null,
      _platform: data.platform ?? null,
      _ip: clientIp(),
    });
    const { data: rows, error } = await supabaseAdmin.rpc("check_device_signup" as any, {
      _fingerprint: data.fingerprint,
      _role: data.role,
    });
    if (error) throw new Error(error.message);
    const r: any = Array.isArray(rows) ? rows[0] : rows;
    return {
      allowed: !!r?.allowed,
      reason: r?.reason ?? "OK",
      deviceId: r?.device_id ?? null,
    };
  });

const OverrideSchema = z.object({
  fingerprint: z.string().min(8).max(200),
  email: z.string().email(),
  reason: z.string().min(10).max(2000),
  contact: z.string().max(200).optional(),
});

export const requestDeviceOverride = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => OverrideSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("request_device_override" as any, {
      _fingerprint: data.fingerprint,
      _email: data.email,
      _reason: data.reason,
      _contact: data.contact ?? null,
    });
    if (error) throw new Error(error.message);
    return { id };
  });

// ---------- Authenticated user ops ----------

const LinkSchema = z.object({
  fingerprint: z.string().min(8).max(200),
  role: z.enum(["customer", "seller", "delivery_agent", "admin"]).default("customer"),
});

export const linkDeviceToCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => LinkSchema.parse(i))
  .handler(async ({ data, context }) => {
    const ip = clientIp();
    const { data: dev, error: rErr } = await context.supabase.rpc("register_device" as any, {
      _fingerprint: data.fingerprint, _ua: null, _platform: null, _ip: ip,
    });
    if (rErr) throw new Error(rErr.message);
    const deviceId = dev as unknown as string;
    const { error: lErr } = await context.supabase.rpc("link_device_account" as any, {
      _device: deviceId, _user: context.userId, _role: data.role,
    });
    if (lErr) throw new Error(lErr.message);
    await context.supabase.from("device_sessions" as any).insert({
      device_id: deviceId, user_id: context.userId, ip, user_agent: null,
    });
    await context.supabase.rpc("recompute_device_risk" as any, { _device: deviceId });
    return { deviceId };
  });

export const listMyDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("device_accounts" as any)
      .select("id, role, is_primary, approval_status, created_at, device:devices(*)")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const removeMyDeviceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("device_accounts" as any).delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const TransferSchema = z.object({ fingerprint: z.string().min(8) });

export const startDeviceTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TransferSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: dev } = await context.supabase.rpc("register_device" as any, {
      _fingerprint: data.fingerprint, _ua: null, _platform: null, _ip: clientIp(),
    });
    const deviceId = dev as unknown as string;
    const { data: otp, error } = await context.supabase.rpc("start_device_transfer" as any, {
      _user: context.userId, _to_device: deviceId,
    });
    if (error) throw new Error(error.message);
    return { otp: otp as unknown as string, deviceId };
  });

export const confirmDeviceTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ fingerprint: z.string(), otp: z.string().length(6) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: dev } = await context.supabase.rpc("register_device" as any, {
      _fingerprint: data.fingerprint, _ua: null, _platform: null, _ip: clientIp(),
    });
    const deviceId = dev as unknown as string;
    const { data: ok, error } = await context.supabase.rpc("complete_device_transfer" as any, {
      _user: context.userId, _to_device: deviceId, _otp: data.otp,
    });
    if (error) throw new Error(error.message);
    return { ok: !!ok };
  });

// ---------- Admin ----------

export const adminListDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ risk: z.string().optional(), search: z.string().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("devices" as any).select("*").order("last_seen_at", { ascending: false }).limit(200);
    if (data.risk && data.risk !== "all") q = q.eq("risk_level", data.risk);
    if (data.search) q = q.ilike("fingerprint", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminDeviceDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const [device, accounts, fraud, audit, sessions] = await Promise.all([
      context.supabase.from("devices" as any).select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("device_accounts" as any).select("*").eq("device_id", data.id),
      context.supabase.from("device_fraud_events" as any).select("*").eq("device_id", data.id).order("created_at", { ascending: false }).limit(50),
      context.supabase.from("device_audit_log" as any).select("*").eq("device_id", data.id).order("created_at", { ascending: false }).limit(50),
      context.supabase.from("device_sessions" as any).select("*").eq("device_id", data.id).order("last_active_at", { ascending: false }).limit(50),
    ]);
    return {
      device: device.data,
      accounts: accounts.data ?? [],
      fraud: fraud.data ?? [],
      audit: audit.data ?? [],
      sessions: sessions.data ?? [],
    };
  });

export const adminBlacklistDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), blacklisted: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("devices" as any)
      .update({ blacklisted: data.blacklisted, status: data.blacklisted ? "blocked" : "active" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("device_audit_log" as any).insert({
      device_id: data.id, user_id: context.userId,
      action: data.blacklisted ? "admin_blacklist" : "admin_unblacklist",
      success: true,
    });
    return { ok: true };
  });

export const adminRemoveDeviceRestriction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await context.supabase.from("device_accounts" as any)
      .update({ approval_status: "approved", approved_by: context.userId, approved_at: new Date().toISOString() })
      .eq("device_id", data.id);
    await context.supabase.from("device_audit_log" as any).insert({
      device_id: data.id, user_id: context.userId, action: "admin_remove_restriction", success: true,
    });
    return { ok: true };
  });

export const adminListOverrideRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("device_override_requests" as any).select("*").order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminDecideOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.rpc("admin_decide_override" as any, {
      _id: data.id, _approve: data.approve, _admin: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDeviceFraudAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [devices, fraud, accounts] = await Promise.all([
      context.supabase.from("devices" as any).select("id, risk_level, blacklisted"),
      context.supabase.from("device_fraud_events" as any).select("kind, created_at"),
      context.supabase.from("device_accounts" as any).select("device_id"),
    ]);
    const fr: any[] = fraud.data ?? [];
    const counts = fr.reduce<Record<string, number>>((a, e) => { a[e.kind] = (a[e.kind] ?? 0) + 1; return a; }, {});
    const devList: any[] = devices.data ?? [];
    const accList: any[] = accounts.data ?? [];
    const perDevice = accList.reduce<Record<string, number>>((a, e) => { a[e.device_id] = (a[e.device_id] ?? 0) + 1; return a; }, {});
    const avg = devList.length ? Object.values(perDevice).reduce((s, n) => s + n, 0) / devList.length : 0;
    return {
      totalDevices: devList.length,
      blacklisted: devList.filter((d) => d.blacklisted).length,
      avgAccountsPerDevice: Math.round(avg * 100) / 100,
      blocked: {
        signup: counts["signup_blocked"] ?? 0,
        role: counts["role_blocked"] ?? 0,
        referral: counts["referral_blocked"] ?? 0,
        coupon: counts["coupon_blocked"] ?? 0,
        wheel: counts["wheel_blocked"] ?? 0,
      },
      riskBreakdown: {
        low: devList.filter((d) => d.risk_level === "low").length,
        medium: devList.filter((d) => d.risk_level === "medium").length,
        high: devList.filter((d) => d.risk_level === "high").length,
        critical: devList.filter((d) => d.risk_level === "critical").length,
      },
    };
  });
