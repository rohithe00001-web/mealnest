import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data;
  },
  staleTime: 1000 * 60 * 5,
});

export interface DishFilters {
  categorySlug?: string;
  search?: string;
  veg?: "veg" | "nonveg" | "all";
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  openNow?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "rating";
}

export const dishesQuery = (filters?: DishFilters) =>
  queryOptions({
    queryKey: [
      "dishes",
      filters?.categorySlug ?? null,
      filters?.search ?? "",
      filters?.veg ?? "all",
      filters?.minPrice ?? null,
      filters?.maxPrice ?? null,
      filters?.minRating ?? null,
      filters?.openNow ?? false,
      filters?.sort ?? "newest",
    ],
    queryFn: async () => {
      let q = supabase
        .from("dishes")
        .select(
          "id, name, description, price, prep_time_min, image_url, is_veg, rating_avg, rating_count, seller_id, category_id, categories(slug, name), sellers!inner(id, kitchen_name, city, status, is_open)",
        )
        .eq("is_available", true)
        .eq("sellers.status", "approved")
        .limit(200);

      if (filters?.veg === "veg") q = q.eq("is_veg", true);
      if (filters?.veg === "nonveg") q = q.eq("is_veg", false);
      if (typeof filters?.minPrice === "number") q = q.gte("price", filters.minPrice);
      if (typeof filters?.maxPrice === "number") q = q.lte("price", filters.maxPrice);
      if (typeof filters?.minRating === "number" && filters.minRating > 0)
        q = q.gte("rating_avg", filters.minRating);
      if (filters?.openNow) q = q.eq("sellers.is_open", true);

      switch (filters?.sort) {
        case "price_asc": q = q.order("price", { ascending: true }); break;
        case "price_desc": q = q.order("price", { ascending: false }); break;
        case "rating": q = q.order("rating_avg", { ascending: false }); break;
        default: q = q.order("created_at", { ascending: false });
      }

      const { data, error } = await q;
      if (error) throw error;
      let rows = data ?? [];
      if (filters?.categorySlug) rows = rows.filter((d: any) => d.categories?.slug === filters.categorySlug);
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        rows = rows.filter(
          (d: any) =>
            d.name.toLowerCase().includes(s) ||
            d.sellers?.kitchen_name?.toLowerCase().includes(s) ||
            d.description?.toLowerCase().includes(s),
        );
      }
      return rows;
    },
  });

export const dishByIdQuery = (id: string) =>
  queryOptions({
    queryKey: ["dish", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dishes")
        .select(
          "*, categories(slug, name), sellers(id, kitchen_name, city, rating_avg, rating_count, address_line)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const sellersQuery = queryOptions({
  queryKey: ["sellers", "marketplace"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("sellers")
      .select(
        "id, slug, kitchen_name, description, city, rating_avg, rating_count, cover_image_url, logo_url, banner_url, cuisines, specialties, is_open, prep_time_min_avg",
      )
      .eq("status", "approved")
      .order("rating_avg", { ascending: false })
      .limit(60);
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 1000 * 60,
});

export const sellerStoreQuery = (idOrSlug: string) =>
  queryOptions({
    queryKey: ["seller-store", idOrSlug],
    queryFn: async () => {
      const isUuid = /^[0-9a-f]{8}-/i.test(idOrSlug);
      const { data: seller, error } = await supabase
        .from("sellers")
        .select(
          "id, slug, kitchen_name, description, story, city, address_line, rating_avg, rating_count, cover_image_url, logo_url, banner_url, gallery, cuisines, specialties, is_open, prep_time_min_avg, business_hours",
        )
        .eq("status", "approved")
        .eq(isUuid ? "id" : "slug", idOrSlug)
        .maybeSingle();
      if (error) throw error;
      if (!seller) return { seller: null, dishes: [], totalOrders: 0 };

      const [{ data: dishes }, { count: totalOrders }] = await Promise.all([
        supabase
          .from("dishes")
          .select(
            "id, name, description, price, prep_time_min, image_url, is_veg, rating_avg, rating_count, seller_id, category_id, badge, is_featured, categories(slug, name)",
          )
          .eq("seller_id", seller.id)
          .eq("is_available", true)
          .order("is_featured", { ascending: false })
          .order("rating_avg", { ascending: false })
          .limit(200),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", seller.id)
          .eq("status", "delivered"),
      ]);
      return { seller, dishes: dishes ?? [], totalOrders: totalOrders ?? 0 };
    },
  });

export const myOrdersQuery = queryOptions({
  queryKey: ["orders", "mine"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*), sellers(kitchen_name, city)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});
