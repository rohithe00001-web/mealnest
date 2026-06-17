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
  .inputValidator((d) => z.object({ status: z.enum(["pending_seller","pending_admin","approved","rejected","suspended"]).optional() }).parse(d ?? {}))
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

// ─────────── Phase 2: Order assignment & agent dashboard ───────────

export const listSellerApprovedAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("delivery_agents")
      .select("id, full_name, phone, rating_avg, delivery_count")
      .eq("seller_id", sellerId).eq("status", "approved").eq("active", true)
      .order("full_name");
    return data ?? [];
  });

export const assignAgentToOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    order_id: z.string().uuid(),
    agent_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    // verify ownership
    const { data: order } = await context.supabase
      .from("orders").select("id, customer_id, seller_id").eq("id", data.order_id).maybeSingle();
    if (!order || order.seller_id !== sellerId) throw new Error("Order not found");
    const { data: agent } = await context.supabase
      .from("delivery_agents").select("id, status, seller_id").eq("id", data.agent_id).maybeSingle();
    if (!agent || agent.seller_id !== sellerId) throw new Error("Agent not in your team");
    if (agent.status !== "approved") throw new Error("Agent not fully approved");

    // upsert assignment (reassign)
    const { data: existing } = await context.supabase
      .from("delivery_assignments").select("id").eq("order_id", data.order_id).maybeSingle();
    if (existing) {
      const { error } = await context.supabase
        .from("delivery_assignments")
        .update({ agent_id: data.agent_id, status: "assigned", assigned_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("delivery_assignments").insert({
        seller_id: sellerId, agent_id: data.agent_id, order_id: data.order_id,
        customer_id: order.user_id, status: "assigned",
      });
      if (error) throw new Error(error.message);
    }
    await context.supabase.from("orders").update({ delivery_agent_id: data.agent_id }).eq("id", data.order_id);
    await logAudit(context.supabase, context.userId, "seller", "assign_agent", "order", data.order_id, { agent_id: data.agent_id });
    return { ok: true };
  });

export const assignAgentToDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    delivery_id: z.string().uuid(),
    agent_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    const { data: del } = await context.supabase
      .from("subscription_deliveries")
      .select("id, seller_id, subscription_id, subscriptions(user_id)")
      .eq("id", data.delivery_id).maybeSingle();
    if (!del || del.seller_id !== sellerId) throw new Error("Delivery not found");
    const customerId = (del as any).subscriptions?.user_id;

    const { data: existing } = await context.supabase
      .from("delivery_assignments").select("id").eq("subscription_delivery_id", data.delivery_id).maybeSingle();
    if (existing) {
      await context.supabase.from("delivery_assignments")
        .update({ agent_id: data.agent_id, status: "assigned", assigned_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await context.supabase.from("delivery_assignments").insert({
        seller_id: sellerId, agent_id: data.agent_id, subscription_delivery_id: data.delivery_id,
        customer_id: customerId, status: "assigned",
      });
    }
    await context.supabase.from("subscription_deliveries")
      .update({ delivery_agent_id: data.agent_id }).eq("id", data.delivery_id);
    return { ok: true };
  });

// Agent: list my assignments
export const agentListMyAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: agents } = await context.supabase
      .from("delivery_agents").select("id, status, seller_id, sellers(kitchen_name, phone)")
      .eq("user_id", context.userId).eq("status", "approved");
    if (!agents || agents.length === 0) return { agent: null, assignments: [] };
    const agentIds = agents.map((a: any) => a.id);
    const { data: assignments } = await context.supabase
      .from("delivery_assignments")
      .select("*, orders(order_number, total, delivery_address), subscription_deliveries(scheduled_date, meals)")
      .in("agent_id", agentIds)
      .order("assigned_at", { ascending: false })
      .limit(50);
    return { agent: agents[0], assignments: assignments ?? [] };
  });

export const agentUpdateAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    assignment_id: z.string().uuid(),
    action: z.enum(["pickup", "deliver", "fail"]),
    otp: z.string().optional(),
    reason: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: a } = await context.supabase
      .from("delivery_assignments")
      .select("*, delivery_agents!inner(user_id)")
      .eq("id", data.assignment_id).maybeSingle();
    if (!a || (a as any).delivery_agents.user_id !== context.userId) throw new Error("Not your assignment");

    const patch: any = {};
    if (data.action === "pickup") {
      patch.status = "picked_up"; patch.picked_up_at = new Date().toISOString();
    } else if (data.action === "deliver") {
      if (!data.otp || data.otp !== a.otp) throw new Error("Wrong OTP");
      patch.status = "delivered"; patch.delivered_at = new Date().toISOString();
      // bump count
      await context.supabase.rpc; // noop placeholder
    } else if (data.action === "fail") {
      patch.status = "failed"; patch.failed_reason = data.reason ?? "";
    }
    const { error } = await context.supabase.from("delivery_assignments").update(patch).eq("id", data.assignment_id);
    if (error) throw new Error(error.message);

    if (data.action === "deliver") {
      // Sync the parent order/delivery, and bump counter
      if (a.order_id) {
        await context.supabase.from("orders").update({ status: "delivered", payment_status: "paid" }).eq("id", a.order_id);
      }
      if (a.subscription_delivery_id) {
        await context.supabase.from("subscription_deliveries")
          .update({ status: "delivered", delivery_status: "delivered" }).eq("id", a.subscription_delivery_id);
      }
      await context.supabase.from("delivery_agents")
        .update({ delivery_count: ((await context.supabase.from("delivery_agents").select("delivery_count").eq("id", a.agent_id).maybeSingle()).data?.delivery_count ?? 0) + 1 })
        .eq("id", a.agent_id);
    }
    return { ok: true };
  });

export const agentUpdateLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    assignment_id: z.string().uuid(),
    lat: z.number(), lng: z.number(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: a } = await context.supabase
      .from("delivery_assignments").select("id, delivery_agents!inner(user_id)")
      .eq("id", data.assignment_id).maybeSingle();
    if (!a || (a as any).delivery_agents.user_id !== context.userId) throw new Error("Not your assignment");
    await context.supabase.from("delivery_assignments").update({
      current_lat: data.lat, current_lng: data.lng, last_location_at: new Date().toISOString(),
    }).eq("id", data.assignment_id);
    return { ok: true };
  });

// Customer: get assignment for one of my orders
export const customerGetAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: a } = await context.supabase
      .from("delivery_assignments")
      .select("id, status, otp, current_lat, current_lng, last_location_at, assigned_at, picked_up_at, delivered_at, delivery_agents(full_name, phone, rating_avg)")
      .eq("order_id", data.order_id).eq("customer_id", context.userId).maybeSingle();
    return a;
  });

// Seller: assignments by order id (current state)
export const sellerGetOrderAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    const { data: a } = await context.supabase
      .from("delivery_assignments")
      .select("id, status, agent_id, otp, delivery_agents(full_name, phone)")
      .eq("order_id", data.order_id).eq("seller_id", sellerId).maybeSingle();
    return a;
  });

