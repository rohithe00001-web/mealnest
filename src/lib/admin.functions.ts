import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [usersC, sellersC, sellersApprovedC, sellersPendingC, ordersC, ordersDeliveredC, revRes, recentRes, dailyRes] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("sellers").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("sellers").select("*", { count: "exact", head: true }).eq("status", "approved"),
        supabaseAdmin.from("sellers").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabaseAdmin.from("orders").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("orders").select("*", { count: "exact", head: true }).eq("status", "delivered"),
        supabaseAdmin.from("orders").select("total, status, created_at").neq("status", "cancelled").neq("status", "rejected"),
        supabaseAdmin
          .from("orders")
          .select("id, order_number, total, status, created_at, sellers(kitchen_name)")
          .order("created_at", { ascending: false })
          .limit(10),
        supabaseAdmin
          .from("orders")
          .select("created_at, total, status")
          .gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
      ]);

    const revenue = (revRes.data ?? []).reduce((s: number, o: any) => s + Number(o.total), 0);
    const byDay = new Map<string, { orders: number; revenue: number }>();
    for (const o of dailyRes.data ?? []) {
      const d = new Date(o.created_at).toISOString().slice(0, 10);
      const cur = byDay.get(d) ?? { orders: 0, revenue: 0 };
      cur.orders += 1;
      if (o.status !== "cancelled" && o.status !== "rejected") cur.revenue += Number(o.total);
      byDay.set(d, cur);
    }
    const daily = Array.from(byDay.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totals: {
        users: usersC.count ?? 0,
        sellers: sellersC.count ?? 0,
        sellersApproved: sellersApprovedC.count ?? 0,
        sellersPending: sellersPendingC.count ?? 0,
        orders: ordersC.count ?? 0,
        ordersDelivered: ordersDeliveredC.count ?? 0,
        revenue,
      },
      recentOrders: recentRes.data ?? [],
      daily,
    };
  });

export const listAdminSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ status: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("sellers")
      .select("id, user_id, kitchen_name, city, phone, email, status, rating_avg, rating_count, created_at, profiles:user_id(full_name)")
      .order("created_at", { ascending: false });
    if (data.status && data.status !== "all") q = q.eq("status", data.status as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateSellerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sellerId: z.string().uuid(),
        status: z.enum(["pending", "approved", "rejected", "suspended"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: seller, error } = await supabaseAdmin
      .from("sellers")
      .update({ status: data.status })
      .eq("id", data.sellerId)
      .select("id, user_id, status")
      .single();
    if (error) throw new Error(error.message);
    if (data.status === "approved") {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: seller.user_id, role: "seller" as any }, { onConflict: "user_id,role" });
    }
    return { ok: true };
  });

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.string().optional(), search: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, total, subtotal, delivery_fee, status, payment_status, payment_method, created_at, customer_id, sellers(kitchen_name, city)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status as any);
    if (data.search) q = q.ilike("order_number", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.customer_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as any[] };
    const nameMap = new Map<string, string>();
    for (const p of profs ?? []) nameMap.set(p.id, p.full_name ?? "");
    return (rows ?? []).map((r: any) => ({ ...r, customer_name: nameMap.get(r.customer_id) ?? null }));
  });

export const updateOrderStatusAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        status: z.enum([
          "placed",
          "accepted",
          "preparing",
          "ready",
          "out_for_delivery",
          "delivered",
          "cancelled",
          "rejected",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { status: data.status };
    if (data.status === "delivered") patch.payment_status = "paid";
    const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, is_blocked, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const ids = (profiles ?? []).map((p) => p.id);
    const [{ data: roles }, { data: orders }, { data: authUsersRes }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("orders").select("customer_id, total").in("customer_id", ids),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const emailMap = new Map<string, string>();
    for (const u of authUsersRes?.users ?? []) emailMap.set(u.id, u.email ?? "");
    const rolesMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    }
    const orderMap = new Map<string, { count: number; spend: number }>();
    for (const o of orders ?? []) {
      const cur = orderMap.get(o.customer_id) ?? { count: 0, spend: 0 };
      cur.count += 1;
      cur.spend += Number(o.total);
      orderMap.set(o.customer_id, cur);
    }
    return (profiles ?? []).map((p) => ({
      ...p,
      email: emailMap.get(p.id) ?? null,
      roles: rolesMap.get(p.id) ?? [],
      order_count: orderMap.get(p.id)?.count ?? 0,
      total_spend: orderMap.get(p.id)?.spend ?? 0,
    }));
  });

export const toggleUserBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), blocked: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Cannot block yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_blocked: data.blocked })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "seller", "customer"]),
        grant: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role === "admin" && !data.grant)
      throw new Error("Cannot remove your own admin role");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role as any }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role as any);
    }
    return { ok: true };
  });
