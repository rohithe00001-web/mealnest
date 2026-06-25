import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getMySeller(supabase: any, userId: string, requireApproved = true) {
  const { data, error } = await supabase
    .from("sellers")
    .select("id, user_id, kitchen_name, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No seller profile found.");
  if (requireApproved && data.status !== "approved")
    throw new Error(`Your kitchen is ${data.status}.`);
  return data;
}

// ============= SELLER =============

export const listSellerPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMySeller(context.supabase, context.userId, false);
    const { data, error } = await context.supabase
      .from("subscription_plans")
      .select("*, subscription_plan_days(*)")
      .eq("seller_id", me.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const DayInput = z.object({
  day_number: z.number().int().min(1).max(31),
  breakfast_name: z.string().max(160).optional().or(z.literal("")),
  breakfast_desc: z.string().max(400).optional().or(z.literal("")),
  lunch_name: z.string().max(160).optional().or(z.literal("")),
  lunch_desc: z.string().max(400).optional().or(z.literal("")),
  dinner_name: z.string().max(160).optional().or(z.literal("")),
  dinner_desc: z.string().max(400).optional().or(z.literal("")),
  calories: z.number().int().min(0).max(10000).default(0),
  protein_g: z.number().int().min(0).max(500).default(0),
  carbs_g: z.number().int().min(0).max(1000).default(0),
  fat_g: z.number().int().min(0).max(500).default(0),
  is_veg: z.boolean().default(true),
});

const PlanInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(160),
  description: z.string().max(1200).optional().or(z.literal("")),
  plan_type: z.enum(["weekly", "half_month", "monthly"]),
  duration_days: z.union([z.literal(7), z.literal(15), z.literal(30)]),
  meal_types: z.array(z.enum(["breakfast", "lunch", "dinner"])).min(1),
  price_per_person: z.number().min(0).max(1000000),
  cuisines: z.array(z.string().max(40)).max(20),
  is_veg: z.boolean(),
  image_url: z.string().max(1000).optional().or(z.literal("")),
  submit_for_review: z.boolean().default(false),
  days: z.array(DayInput),
});

export const upsertSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PlanInput.parse(d))
  .handler(async ({ context, data }) => {
    const me = await getMySeller(context.supabase, context.userId);
    const payload: any = {
      seller_id: me.id,
      title: data.title,
      description: data.description || null,
      plan_type: data.plan_type,
      duration_days: data.duration_days,
      meal_types: data.meal_types,
      price_per_person: data.price_per_person,
      cuisines: data.cuisines,
      is_veg: data.is_veg,
      image_url: data.image_url || null,
      status: data.submit_for_review ? "pending" : "draft",
    };

    let planId = data.id;
    if (planId) {
      const { error } = await context.supabase
        .from("subscription_plans")
        .update(payload)
        .eq("id", planId)
        .eq("seller_id", me.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await context.supabase
        .from("subscription_plans")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      planId = row.id;
    }

    // Replace days
    await context.supabase.from("subscription_plan_days").delete().eq("plan_id", planId!);
    const dayRows = data.days.map((d) => ({
      plan_id: planId,
      day_number: d.day_number,
      breakfast_name: d.breakfast_name || null,
      breakfast_desc: d.breakfast_desc || null,
      lunch_name: d.lunch_name || null,
      lunch_desc: d.lunch_desc || null,
      dinner_name: d.dinner_name || null,
      dinner_desc: d.dinner_desc || null,
      calories: d.calories,
      protein_g: d.protein_g,
      carbs_g: d.carbs_g,
      fat_g: d.fat_g,
      is_veg: d.is_veg,
    }));
    if (dayRows.length) {
      const { error } = await context.supabase.from("subscription_plan_days").insert(dayRows);
      if (error) throw new Error(error.message);
    }
    return { id: planId };
  });

export const duplicateSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const me = await getMySeller(context.supabase, context.userId);
    const { data: plan, error: pe } = await context.supabase
      .from("subscription_plans")
      .select("*, subscription_plan_days(*)")
      .eq("id", data.id)
      .eq("seller_id", me.id)
      .single();
    if (pe) throw new Error(pe.message);

    const { subscription_plan_days, id, created_at, updated_at, rating_avg, rating_count, ...rest } = plan as any;
    const { data: newPlan, error: ne } = await context.supabase
      .from("subscription_plans")
      .insert({ ...rest, title: `${rest.title} (Copy)`, status: "draft" })
      .select("id")
      .single();
    if (ne) throw new Error(ne.message);

    if (subscription_plan_days?.length) {
      const newDays = subscription_plan_days.map((d: any) => {
        const { id: _i, plan_id: _p, created_at: _c, ...rd } = d;
        return { ...rd, plan_id: newPlan.id };
      });
      await context.supabase.from("subscription_plan_days").insert(newDays);
    }
    return { id: newPlan.id };
  });

export const deleteSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const me = await getMySeller(context.supabase, context.userId, false);
    const { error } = await context.supabase
      .from("subscription_plans")
      .delete()
      .eq("id", data.id)
      .eq("seller_id", me.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= CUSTOMER =============

export const listSubscriptionMarketplace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      plan_type: z.enum(["weekly", "half_month", "monthly"]).optional(),
      is_veg: z.boolean().optional(),
      max_price: z.number().optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("subscription_plans")
      .select("*, sellers(kitchen_name, rating_avg, rating_count, city)")
      .eq("status", "approved")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (data.plan_type) q = q.eq("plan_type", data.plan_type);
    if (data.is_veg !== undefined) q = q.eq("is_veg", data.is_veg);
    if (data.max_price) q = q.lte("price_per_person", data.max_price);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getSubscriptionPlanDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: plan, error } = await context.supabase
      .from("subscription_plans")
      .select("*, sellers(id, kitchen_name, rating_avg, rating_count, city, description), subscription_plan_days(*)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return plan;
  });

const SubscribeInput = z.object({
  plan_id: z.string().uuid(),
  people_count: z.number().int().min(1).max(20),
  meal_selection: z.enum([
    "breakfast_only", "lunch_only", "dinner_only",
    "breakfast_lunch", "lunch_dinner", "full_day",
  ]),
  address_id: z.string().uuid(),
  delivery_slot: z.string().max(40),
  start_date: z.string(),
  customizations: z.object({
    exclude_dishes: z.array(z.string()).default([]),
    spice_level: z.enum(["mild", "medium", "spicy"]).default("medium"),
    diet: z.enum(["veg", "non_veg", "vegan"]).default("veg"),
    allergies: z.array(z.string()).default([]),
  }),
});

export const createSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubscribeInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: plan, error: pe } = await context.supabase
      .from("subscription_plans")
      .select("id, seller_id, price_per_person, duration_days, status, is_active")
      .eq("id", data.plan_id)
      .single();
    if (pe) throw new Error(pe.message);
    if (plan.status !== "approved" || !plan.is_active) throw new Error("Plan unavailable");

    const { data: address, error: ae } = await context.supabase
      .from("addresses")
      .select("*")
      .eq("id", data.address_id)
      .eq("user_id", context.userId)
      .single();
    if (ae) throw new Error(ae.message);

    const total = Number(plan.price_per_person) * data.people_count;
    const start = new Date(data.start_date);
    const end = new Date(start);
    end.setDate(end.getDate() + plan.duration_days - 1);

    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .insert({
        customer_id: context.userId,
        plan_id: plan.id,
        seller_id: plan.seller_id,
        people_count: data.people_count,
        meal_selection: data.meal_selection,
        address_id: address.id,
        delivery_address: address,
        delivery_slot: data.delivery_slot,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        total_price: total,
        customizations: data.customizations,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: sub.id };
  });

export const listMySubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select("*, subscription_plans(title, plan_type, duration_days, image_url), sellers(kitchen_name)")
      .eq("customer_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMySubscriptionDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("*, subscription_plans(*), sellers(kitchen_name, phone, city), subscription_deliveries(*)")
      .eq("id", data.id)
      .eq("customer_id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return sub;
  });

export const skipDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ delivery_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc(
      "skip_my_subscription_delivery" as any,
      { _delivery_id: data.delivery_id },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const pauseSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), pause: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("subscriptions")
      .update({ status: data.pause ? "paused" : "active" })
      .eq("id", data.id)
      .eq("customer_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("customer_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= SELLER subscription views =============

export const listSellerSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMySeller(context.supabase, context.userId, false);
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select("*, subscription_plans(title, plan_type, duration_days)")
      .eq("seller_id", me.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listSellerDeliveriesToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMySeller(context.supabase, context.userId, false);
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await context.supabase
      .from("subscription_deliveries")
      .select("*, subscriptions(customer_id, people_count, meal_selection, delivery_address, delivery_slot, customizations)")
      .eq("seller_id", me.id)
      .eq("scheduled_date", today)
      .in("status", ["scheduled"])
      .order("scheduled_date");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markDeliveryDelivered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ delivery_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const me = await getMySeller(context.supabase, context.userId, false);
    const { error } = await context.supabase
      .from("subscription_deliveries")
      .update({ status: "delivered" })
      .eq("id", data.delivery_id)
      .eq("seller_id", me.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= ADMIN =============

export const adminListAllPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("subscription_plans")
      .select("*, sellers(kitchen_name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpdatePlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["draft", "pending", "approved", "rejected"]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("subscription_plans")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSubscriptionStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: subs, error } = await context.supabase
      .from("subscriptions")
      .select("status, total_price, customer_id, subscription_plans(plan_type)");
    if (error) throw new Error(error.message);
    const rows = subs ?? [];
    const byType = { weekly: 0, half_month: 0, monthly: 0 } as Record<string, number>;
    let revenue = 0;
    const customers = new Set<string>();
    const repeating = new Map<string, number>();
    for (const s of rows as any[]) {
      const t = s.subscription_plans?.plan_type;
      if (t) byType[t] = (byType[t] ?? 0) + 1;
      revenue += Number(s.total_price ?? 0);
      customers.add(s.customer_id);
      repeating.set(s.customer_id, (repeating.get(s.customer_id) ?? 0) + 1);
    }
    const repeatCount = Array.from(repeating.values()).filter((n) => n > 1).length;
    const retention = customers.size ? Math.round((repeatCount / customers.size) * 100) : 0;
    const active = rows.filter((s: any) => s.status === "active").length;
    return { total: rows.length, active, revenue, byType, retention, totalCustomers: customers.size };
  });

// ============= AI (Lovable AI Gateway) =============

async function callLovableAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit reached. Try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Please top up workspace credits.");
  if (!res.ok) throw new Error(`AI error (${res.status})`);
  const json: any = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export const aiRecommendPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: orders } = await context.supabase
      .from("orders")
      .select("id, order_items(dish_id, dishes(name, cuisine, is_veg))")
      .eq("customer_id", context.userId)
      .limit(20);

    const { data: plans } = await context.supabase
      .from("subscription_plans")
      .select("id, title, plan_type, duration_days, price_per_person, cuisines, is_veg, description, sellers(kitchen_name)")
      .eq("status", "approved")
      .eq("is_active", true)
      .limit(40);

    const history = (orders ?? []).flatMap((o: any) =>
      (o.order_items ?? []).map((i: any) => ({
        name: i.dishes?.name, cuisine: i.dishes?.cuisine, veg: i.dishes?.is_veg,
      })),
    );
    const planList = (plans ?? []).map((p: any) => ({
      id: p.id, title: p.title, type: p.plan_type, days: p.duration_days,
      price: Number(p.price_per_person), cuisines: p.cuisines, veg: p.is_veg,
      kitchen: p.sellers?.kitchen_name,
    }));
    if (!planList.length) return { recommendations: [], summary: "No plans available yet." };

    const sys = 'You recommend homemade meal subscription plans. Reply in strict JSON: {"summary":string,"recommendations":[{"plan_id":string,"reason":string}]}. Pick up to 3 plan_ids from the provided list only.';
    const user = `Order history (recent dishes):\n${JSON.stringify(history).slice(0, 2000)}\n\nAvailable plans:\n${JSON.stringify(planList)}\n\nRecommend the best 1-3 plans for this customer.`;
    const text = await callLovableAI(sys, user);
    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return { summary: text, recommendations: [] };
    }
  });

export const aiNutritionSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subscription_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("id, customizations, subscription_deliveries(meals, day_number, scheduled_date)")
      .eq("id", data.subscription_id)
      .eq("customer_id", context.userId)
      .single();
    if (error) throw new Error(error.message);

    const meals = (sub.subscription_deliveries ?? []).slice(0, 14).map((d: any) => d.meals);
    const totals = meals.reduce(
      (acc: any, m: any) => ({
        calories: acc.calories + Number(m?.calories ?? 0),
        protein_g: acc.protein_g + Number(m?.protein_g ?? 0),
        carbs_g: acc.carbs_g + Number(m?.carbs_g ?? 0),
        fat_g: acc.fat_g + Number(m?.fat_g ?? 0),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );
    const days = meals.length || 1;
    const avg = {
      calories: Math.round(totals.calories / days),
      protein_g: Math.round(totals.protein_g / days),
      carbs_g: Math.round(totals.carbs_g / days),
      fat_g: Math.round(totals.fat_g / days),
    };

    const sys = "You are a friendly nutrition assistant. Give a concise 3-4 sentence summary of the weekly diet, then 2-3 bullet suggestions. Use plain text with '- ' bullets. No markdown headings.";
    const user = `Customer preferences: ${JSON.stringify(sub.customizations)}\nDaily averages (${days} days): ${JSON.stringify(avg)}\nMeals: ${JSON.stringify(meals).slice(0, 1500)}`;
    const text = await callLovableAI(sys, user);
    return { summary: text, averages: avg, days };
  });
