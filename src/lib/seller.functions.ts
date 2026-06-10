import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getMySeller(supabase: any, userId: string, requireApproved = true) {
  const { data, error } = await supabase
    .from("sellers")
    .select("id, user_id, kitchen_name, status, is_open")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No seller profile found. Apply to become a seller first.");
  if (requireApproved && data.status !== "approved")
    throw new Error(`Your kitchen is ${data.status}. Wait for admin approval.`);
  return data;
}

export const getSellerMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("sellers")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data;
  });

export const getSellerStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMySeller(context.supabase, context.userId);
    const [ordersAll, ordersPending, ordersToday, dishesCount, recent] = await Promise.all([
      context.supabase.from("orders").select("total, status, created_at").eq("seller_id", me.id),
      context.supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", me.id)
        .in("status", ["placed", "accepted", "preparing", "ready", "out_for_delivery"]),
      context.supabase
        .from("orders")
        .select("total")
        .eq("seller_id", me.id)
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      context.supabase.from("dishes").select("id", { count: "exact", head: true }).eq("seller_id", me.id),
      context.supabase
        .from("orders")
        .select("id, order_number, total, status, created_at")
        .eq("seller_id", me.id)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const all = (ordersAll.data ?? []).filter(
      (o: any) => o.status !== "cancelled" && o.status !== "rejected",
    );
    const revenue = all.reduce((s: number, o: any) => s + Number(o.total), 0);
    const todayRevenue = (ordersToday.data ?? []).reduce((s: number, o: any) => s + Number(o.total), 0);

    return {
      seller: me,
      totals: {
        revenue,
        todayRevenue,
        totalOrders: ordersAll.data?.length ?? 0,
        activeOrders: ordersPending.count ?? 0,
        dishes: dishesCount.count ?? 0,
      },
      recentOrders: recent.data ?? [],
    };
  });

export const listSellerOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ status: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const me = await getMySeller(context.supabase, context.userId, false);
    let q = context.supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("seller_id", me.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateSellerOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        status: z.enum([
          "accepted",
          "preparing",
          "ready",
          "out_for_delivery",
          "delivered",
          "rejected",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const me = await getMySeller(context.supabase, context.userId, false);
    const patch: any = { status: data.status };
    if (data.status === "delivered") patch.payment_status = "paid";
    const { error } = await context.supabase
      .from("orders")
      .update(patch)
      .eq("id", data.orderId)
      .eq("seller_id", me.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSellerDishes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMySeller(context.supabase, context.userId, false);
    const { data, error } = await context.supabase
      .from("dishes")
      .select("*, categories(name, slug)")
      .eq("seller_id", me.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const DishInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(800).optional().or(z.literal("")),
  ingredients: z.string().max(800).optional().or(z.literal("")),
  price: z.number().min(0).max(100000),
  prepTimeMin: z.number().int().min(1).max(720),
  stock: z.number().int().min(0).max(10000),
  isVeg: z.boolean(),
  isAvailable: z.boolean(),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  imagePath: z.string().max(400).optional().or(z.literal("")),
});

async function signedUrlFor(supabase: any, path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabase.storage.from("dish-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  return data?.signedUrl ?? null;
}

export const upsertDish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), data: DishInput }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const me = await getMySeller(context.supabase, context.userId);
    const imageUrl = data.data.imagePath ? await signedUrlFor(context.supabase, data.data.imagePath) : null;
    const payload: any = {
      seller_id: me.id,
      name: data.data.name,
      description: data.data.description || null,
      ingredients: data.data.ingredients || null,
      price: data.data.price,
      prep_time_min: data.data.prepTimeMin,
      stock: data.data.stock,
      is_veg: data.data.isVeg,
      is_available: data.data.isAvailable,
      category_id: data.data.categoryId || null,
    };
    if (data.data.imagePath !== undefined) payload.image_url = imageUrl;

    if (data.id) {
      const { error } = await context.supabase.from("dishes").update(payload).eq("id", data.id).eq("seller_id", me.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase.from("dishes").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteDish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const me = await getMySeller(context.supabase, context.userId, false);
    const { error } = await context.supabase
      .from("dishes")
      .delete()
      .eq("id", data.id)
      .eq("seller_id", me.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDishUploadInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMySeller(context.supabase, context.userId, false);
    return { sellerId: me.id };
  });

export const updateSellerOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ isOpen: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const me = await getMySeller(context.supabase, context.userId, false);
    const { error } = await context.supabase.from("sellers").update({ is_open: data.isOpen }).eq("id", me.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
