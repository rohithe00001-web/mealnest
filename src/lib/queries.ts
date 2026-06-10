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

export const dishesQuery = (filters?: { categorySlug?: string; search?: string }) =>
  queryOptions({
    queryKey: ["dishes", filters?.categorySlug ?? null, filters?.search ?? ""],
    queryFn: async () => {
      let q = supabase
        .from("dishes")
        .select(
          "id, name, description, price, prep_time_min, image_url, is_veg, rating_avg, rating_count, seller_id, category_id, categories(slug, name), sellers!inner(id, kitchen_name, city, status)",
        )
        .eq("is_available", true)
        .eq("sellers.status", "approved")
        .order("created_at", { ascending: false })
        .limit(60);
      if (filters?.search) q = q.ilike("name", `%${filters.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data ?? [];
      if (filters?.categorySlug) {
        rows = rows.filter((d: any) => d.categories?.slug === filters.categorySlug);
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
  queryKey: ["sellers"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("sellers")
      .select("id, kitchen_name, description, city, rating_avg, rating_count, cover_image_url")
      .eq("status", "approved")
      .order("rating_avg", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
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
