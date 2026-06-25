import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Sensitive columns (aadhaar_number, license_number, *_doc_url) are revoked
// from the authenticated role. Always select this explicit list instead of *.
const AGENT_SAFE_COLS = "id, user_id, seller_id, full_name, phone, email, vehicle_type, vehicle_number, background_check_passed, status, seller_approved_at, admin_approved_at, rejected_reason, rating_avg, delivery_count, active, created_at, updated_at";

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
    // delivery_agent role is granted by admin on approval, not self-granted
    return { id: row.id };
  });

export const getMyAgentProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("delivery_agents")
      .select(`${AGENT_SAFE_COLS}, sellers(kitchen_name)`)
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
    const { data: updated, error } = await context.supabase.from("delivery_agents")
      .update(update).eq("id", data.agent_id).select("user_id").single();
    if (error) throw new Error(error.message);
    if (data.approve && updated?.user_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("user_roles")
        .upsert({ user_id: updated.user_id, role: "delivery_agent" as any }, { onConflict: "user_id,role" });
    }
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
        customer_id: order.customer_id, status: "assigned",
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
      if (a.agent_id) {
        const cur = await context.supabase.from("delivery_agents").select("delivery_count").eq("id", a.agent_id).maybeSingle();
        await context.supabase.from("delivery_agents")
          .update({ delivery_count: (cur.data?.delivery_count ?? 0) + 1 })
          .eq("id", a.agent_id);
      }
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


// ─────────── Phase 3: Schedules ───────────
export const listAgentSchedules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ agent_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    let q = context.supabase.from("agent_schedules")
      .select("*, delivery_agents!inner(id, full_name, seller_id), delivery_zones(name, pincode)")
      .eq("delivery_agents.seller_id", sellerId);
    if (data.agent_id) q = q.eq("agent_id", data.agent_id);
    const { data: rows, error } = await q.order("weekday").order("slot");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertAgentSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    agent_id: z.string().uuid(),
    weekday: z.number().int().min(0).max(6),
    slot: z.enum(["morning","afternoon","evening"]),
    active: z.boolean().default(true),
    zone_id: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    const { data: agent } = await context.supabase.from("delivery_agents")
      .select("id, seller_id").eq("id", data.agent_id).maybeSingle();
    if (!agent || agent.seller_id !== sellerId) throw new Error("Agent not in your team");
    const { error } = await context.supabase.from("agent_schedules")
      .upsert({ agent_id: data.agent_id, weekday: data.weekday, slot: data.slot, active: data.active, zone_id: data.zone_id ?? null },
              { onConflict: "agent_id,weekday,slot" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAgentSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    const { data: sch } = await context.supabase.from("agent_schedules")
      .select("id, delivery_agents!inner(seller_id)").eq("id", data.id).maybeSingle();
    if (!sch || (sch as any).delivery_agents.seller_id !== sellerId) throw new Error("Not allowed");
    const { error } = await context.supabase.from("agent_schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────── Phase 3: Payroll ───────────
export const listAgentPayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ month: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    let q = context.supabase.from("agent_payroll")
      .select("*, delivery_agents!inner(id, full_name, seller_id)")
      .eq("delivery_agents.seller_id", sellerId);
    if (data.month) q = q.eq("month", data.month);
    const { data: rows, error } = await q.order("month", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertAgentPayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    agent_id: z.string().uuid(),
    month: z.string(), // YYYY-MM-01
    salary_base: z.number().min(0).default(0),
    per_order_rate: z.number().min(0).default(0),
    status: z.enum(["pending","approved","paid"]).default("pending"),
    paid_amount: z.number().min(0).default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    const { data: agent } = await context.supabase.from("delivery_agents")
      .select("id, seller_id").eq("id", data.agent_id).maybeSingle();
    if (!agent || agent.seller_id !== sellerId) throw new Error("Agent not in your team");

    // count delivered assignments for that month
    const start = data.month;
    const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 1).toISOString().slice(0, 10);
    const { count } = await context.supabase
      .from("delivery_assignments").select("id", { count: "exact", head: true })
      .eq("agent_id", data.agent_id).eq("status", "delivered")
      .gte("delivered_at", start).lt("delivered_at", end);
    const delivered = count ?? 0;
    const computed = Number(data.salary_base) + Number(data.per_order_rate) * delivered;

    const { error } = await context.supabase.from("agent_payroll").upsert({
      agent_id: data.agent_id, month: data.month,
      salary_base: data.salary_base, per_order_rate: data.per_order_rate,
      computed_amount: computed, paid_amount: data.paid_amount, status: data.status,
      incentive_rules: { delivered_orders: delivered },
    }, { onConflict: "agent_id,month" });
    if (error) throw new Error(error.message);
    return { ok: true, computed, delivered };
  });

// Agent: see my own payroll
export const agentListMyPayroll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("agent_payroll")
      .select("*, delivery_agents!inner(user_id)")
      .eq("delivery_agents.user_id", context.userId)
      .order("month", { ascending: false });
    return data ?? [];
  });

// ─────────── Phase 3: Performance ───────────
export const sellerAgentPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    const { data: agents } = await context.supabase.from("delivery_agents")
      .select("id, full_name, rating_avg, delivery_count, status").eq("seller_id", sellerId);
    if (!agents?.length) return [];
    const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    const { data: assigns } = await context.supabase.from("delivery_assignments")
      .select("agent_id, status, assigned_at, delivered_at")
      .eq("seller_id", sellerId).gte("assigned_at", since);
    return agents.map((a: any) => {
      const mine = (assigns ?? []).filter((x: any) => x.agent_id === a.id);
      const delivered = mine.filter((x) => x.status === "delivered");
      const failed = mine.filter((x) => x.status === "failed").length;
      const avgMin = delivered.length
        ? Math.round(delivered.reduce((s, x: any) =>
            s + (new Date(x.delivered_at).getTime() - new Date(x.assigned_at).getTime()) / 60000, 0) / delivered.length)
        : 0;
      const rate = mine.length ? Math.round((delivered.length / mine.length) * 100) : 0;
      return { ...a, last30_assigned: mine.length, last30_delivered: delivered.length, last30_failed: failed, success_rate: rate, avg_minutes: avgMin };
    });
  });

// ─────────── Phase 3: Zones ───────────
export const listSellerZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    const { data } = await context.supabase.from("delivery_zones")
      .select("*").eq("seller_id", sellerId).order("created_at", { ascending: false });
    return data ?? [];
  });

export const upsertSellerZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(80),
    pincode: z.string().min(3).max(12),
    radius_km: z.number().min(0.1).max(50),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    if (data.id) {
      const { error } = await context.supabase.from("delivery_zones")
        .update({ name: data.name, pincode: data.pincode, radius_km: data.radius_km, admin_approved: false })
        .eq("id", data.id).eq("seller_id", sellerId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("delivery_zones")
        .insert({ seller_id: sellerId, name: data.name, pincode: data.pincode, radius_km: data.radius_km });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteSellerZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sellerId = await getMySellerId(context.supabase, context.userId);
    const { error } = await context.supabase.from("delivery_zones").delete().eq("id", data.id).eq("seller_id", sellerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin: zones
export const adminListZones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pending_only: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    let q = context.supabase.from("delivery_zones")
      .select("*, sellers(kitchen_name)").order("created_at", { ascending: false });
    if (data.pending_only) q = q.eq("admin_approved", false);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminApproveZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), approve: z.boolean(), reason: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const update = data.approve
      ? { admin_approved: true, admin_approved_at: new Date().toISOString(), rejected_reason: null }
      : { admin_approved: false, rejected_reason: data.reason ?? "Rejected" };
    const { error } = await context.supabase.from("delivery_zones").update(update).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, context.userId, "admin", data.approve ? "approve_zone" : "reject_zone", "delivery_zone", data.id);
    return { ok: true };
  });

// Admin: compliance overview
export const adminDeliveryCompliance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const [pendingAgents, pendingZones, suspendedAgents, lowRating] = await Promise.all([
      context.supabase.from("delivery_agents").select("id", { count: "exact", head: true }).eq("status", "pending_admin"),
      context.supabase.from("delivery_zones").select("id", { count: "exact", head: true }).eq("admin_approved", false),
      context.supabase.from("delivery_agents").select("id", { count: "exact", head: true }).eq("status", "suspended"),
      context.supabase.from("delivery_agents").select("id, full_name, rating_avg, sellers(kitchen_name)").lt("rating_avg", 3).gt("delivery_count", 5).limit(10),
    ]);
    return {
      pending_agents: pendingAgents.count ?? 0,
      pending_zones: pendingZones.count ?? 0,
      suspended_agents: suspendedAgents.count ?? 0,
      low_rated: lowRating.data ?? [],
    };
  });

// ─────────── Phase 4: Admin monitoring & analytics ───────────
export const adminLiveAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("delivery_assignments")
      .select("id, status, assigned_at, picked_up_at, delivered_at, current_lat, current_lng, last_location_at, seller_id, agent_id, sellers(kitchen_name), delivery_agents(full_name, phone), orders(order_number, total)")
      .in("status", ["assigned", "picked_up"])
      .order("assigned_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const adminDeliveryAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    const [assigns, sellersAgg] = await Promise.all([
      context.supabase.from("delivery_assignments")
        .select("status, assigned_at, delivered_at, seller_id, sellers(kitchen_name)")
        .gte("assigned_at", since),
      context.supabase.from("delivery_agents")
        .select("seller_id, status, rating_avg, delivery_count, sellers(kitchen_name)"),
    ]);
    const rows = assigns.data ?? [];
    const total = rows.length;
    const delivered = rows.filter((r: any) => r.status === "delivered");
    const failed = rows.filter((r: any) => r.status === "failed").length;
    const avgMin = delivered.length
      ? Math.round(delivered.reduce((s, r: any) => s + (new Date(r.delivered_at).getTime() - new Date(r.assigned_at).getTime()) / 60000, 0) / delivered.length)
      : 0;
    // Per-seller breakdown
    const sellerMap = new Map<string, any>();
    rows.forEach((r: any) => {
      const k = r.seller_id;
      const cur = sellerMap.get(k) ?? { seller_id: k, kitchen_name: r.sellers?.kitchen_name, assigned: 0, delivered: 0, failed: 0 };
      cur.assigned++;
      if (r.status === "delivered") cur.delivered++;
      if (r.status === "failed") cur.failed++;
      sellerMap.set(k, cur);
    });
    // Daily series
    const byDay = new Map<string, number>();
    rows.forEach((r: any) => {
      const d = new Date(r.assigned_at).toISOString().slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    });
    const series = Array.from(byDay.entries()).sort().map(([day, count]) => ({ day, count }));
    // Agent counts per seller
    const agentSeller = new Map<string, number>();
    (sellersAgg.data ?? []).forEach((a: any) => {
      agentSeller.set(a.seller_id, (agentSeller.get(a.seller_id) ?? 0) + 1);
    });
    const sellers = Array.from(sellerMap.values()).map((s) => ({
      ...s, agents: agentSeller.get(s.seller_id) ?? 0,
      success_rate: s.assigned ? Math.round((s.delivered / s.assigned) * 100) : 0,
    })).sort((a, b) => b.assigned - a.assigned);
    return {
      total_assignments: total,
      delivered: delivered.length,
      failed,
      success_rate: total ? Math.round((delivered.length / total) * 100) : 0,
      avg_minutes: avgMin,
      total_agents: sellersAgg.data?.length ?? 0,
      series,
      sellers,
    };
  });

// Admin emergency: force-cancel assignment (frees order for reassignment)
export const adminCancelAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assignment_id: z.string().uuid(), reason: z.string().min(2) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("delivery_assignments")
      .update({ status: "cancelled", failed_reason: data.reason }).eq("id", data.assignment_id);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, context.userId, "admin", "emergency_cancel", "assignment", data.assignment_id, { reason: data.reason });
    return { ok: true };
  });
