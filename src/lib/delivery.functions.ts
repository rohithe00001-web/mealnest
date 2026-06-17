import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getMySellerId(supabase: any, userId: string) {
  const { data } = await supabase.from("sellers").select("id, status").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("No seller profile");
  if (data.status !== "approved") throw new Error("Seller not approved");
  return data.id as string;
}

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

async function logAudit(supabase: any, userId: string, role: string, action: string, entity: string, id: string, details: any = {}) {
  await supabase.from("delivery_audit_log").insert({
    actor_id: userId, actor_role: role, action, entity_type: entity, entity_id: id, details,
  });
}

// ─────────── Agent ───────────
export const registerDeliveryAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    seller_id: z.string().uuid(),
    full_name: z.string().min(2).max(80),
    phone: z.string().min(7).max(20),
    email: z.string().email().optional().or(z.literal("")),
    vehicle_type: z.string().max(40).optional(),
    vehicle_number: z.string().max(40).optional(),
    aadhaar_number: z.string().max(20).optional(),
    license_number: z.string().max(40).optional(),
    id_doc_url: z.string().optional(),
    license_doc_url: z.string().optional(),
    vehicle_doc_url: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("delivery_agents")
      .insert({ ...data, user_id: context.userId, status: "pending_seller" })
      .select("id").single();
    if (error) throw new Error(error.message);
    // also add delivery_agent role
    await context.supabase.from("user_roles").insert({ user_id: context.userId, role: "delivery_agent" });
    return { id: row.id };
  });

export const getMyAgentProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("delivery_agents")
      .select("*, sellers(kitchen_name)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

// ─────────── Seller ───────────
export const listSellerAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("delivery_agents").select("*").eq("seller_id", sellerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const sellerInviteAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    user_email: z.string().email(),
    full_name: z.string().min(2),
    phone: z.string().min(7),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    // Look up user by email via profiles (since no admin client here)
    const { data: profile } = await context.supabase
      .from("profiles").select("id").ilike("full_name", `%${data.user_email}%`).maybeSingle();
    if (!profile) throw new Error("User not found. Ask them to sign up first and register via /delivery/register.");
    const { error } = await context.supabase.from("delivery_agents").insert({
      seller_id: sellerId, user_id: profile.id, full_name: data.full_name,
      phone: data.phone, status: "pending_seller",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sellerApproveAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ agent_id: z.string().uuid(), approve: z.boolean(), reason: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    const update = data.approve
      ? { status: "pending_admin" as const, seller_approved_at: new Date().toISOString() }
      : { status: "rejected" as const, rejected_reason: data.reason ?? "Rejected by seller" };
    const { error } = await context.supabase
      .from("delivery_agents").update(update).eq("id", data.agent_id).eq("seller_id", sellerId);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, context.userId, "seller", data.approve ? "seller_approve" : "seller_reject", "delivery_agent", data.agent_id);
    return { ok: true };
  });

export const sellerSuspendAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ agent_id: z.string().uuid(), suspend: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    const { error } = await context.supabase.from("delivery_agents")
      .update({ status: data.suspend ? "suspended" : "approved", active: !data.suspend })
      .eq("id", data.agent_id).eq("seller_id", sellerId);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, context.userId, "seller", data.suspend ? "suspend" : "reinstate", "delivery_agent", data.agent_id);
    return { ok: true };
  });

export const sellerRemoveAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ agent_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    const { error } = await context.supabase.from("delivery_agents").delete().eq("id", data.agent_id).eq("seller_id", sellerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────── Admin ───────────
export const adminListAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    let q = context.supabase.from("delivery_agents").select("*, sellers(kitchen_name)").order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminApproveAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ agent_id: z.string().uuid(), approve: z.boolean(), reason: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const update = data.approve
      ? { status: "approved" as const, admin_approved_at: new Date().toISOString(), background_check_passed: true }
      : { status: "rejected" as const, rejected_reason: data.reason ?? "Rejected by admin" };
    const { error } = await context.supabase.from("delivery_agents").update(update).eq("id", data.agent_id);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, context.userId, "admin", data.approve ? "admin_approve" : "admin_reject", "delivery_agent", data.agent_id);
    return { ok: true };
  });

export const adminSuspendAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ agent_id: z.string().uuid(), suspend: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("delivery_agents")
      .update({ status: data.suspend ? "suspended" : "approved", active: !data.suspend })
      .eq("id", data.agent_id);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, context.userId, "admin", data.suspend ? "admin_suspend" : "admin_reinstate", "delivery_agent", data.agent_id);
    return { ok: true };
  });

// ─────────── Public seller listing for register page ───────────
export const listApprovedSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("sellers").select("id, kitchen_name, city").eq("status", "approved").order("kitchen_name");
    return data ?? [];
  });
