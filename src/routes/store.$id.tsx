import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DishCard } from "@/components/DishCard";
import { sellerStoreQuery } from "@/lib/queries";
import { Star, Clock, MapPin, Search, ShoppingBag, Sparkles, Flame, Award, Plus } from "lucide-react";

export const Route = createFileRoute("/store/$id")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(sellerStoreQuery(params.id));
    if (!data?.seller) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const s = loaderData?.seller;
    const title = s ? `${s.kitchen_name} — MealNest` : "Kitchen — MealNest";
    const desc = s?.description ?? "Order homemade meals from this neighborhood kitchen on MealNest.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(s?.banner_url ? [{ property: "og:image", content: s.banner_url }] : []),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-16">
        <h1 className="font-display text-2xl font-semibold">Kitchen not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This storefront isn't available.{" "}
          <Link to="/" className="text-primary underline">Browse kitchens</Link>.
        </p>
      </main>
      <Footer />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="container-page py-16 text-sm text-destructive">{(error as Error).message}</div>
  ),
  component: StorePage,
});

const CATEGORY_ORDER = ["breakfast", "lunch", "dinner", "snacks", "beverages", "desserts"];

const BADGE_META: Record<string, { label: string; icon: any; className: string }> = {
  best_seller: { label: "Best Seller", icon: Flame, className: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  chef_special: { label: "Chef Special", icon: Award, className: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  recommended: { label: "Recommended", icon: Sparkles, className: "bg-primary/15 text-primary" },
  new: { label: "New", icon: Plus, className: "bg-success/15 text-success" },
};

function StorePage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(sellerStoreQuery(id));
  const seller = data.seller!;
  const dishes = data.dishes;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<"popular" | "price_asc" | "price_desc">("popular");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const d of dishes) if ((d as any).categories?.slug) set.add((d as any).categories.slug);
    const ordered = CATEGORY_ORDER.filter((c) => set.has(c));
    const extra = Array.from(set).filter((c) => !CATEGORY_ORDER.includes(c));
    return [...ordered, ...extra];
  }, [dishes]);

  const filtered = useMemo(() => {
    let rows = dishes.slice();
    if (category !== "all") rows = rows.filter((d: any) => d.categories?.slug === category);
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (d: any) =>
          d.name.toLowerCase().includes(s) ||
          (d.description ?? "").toLowerCase().includes(s),
      );
    }
    if (sort === "price_asc") rows.sort((a: any, b: any) => Number(a.price) - Number(b.price));
    else if (sort === "price_desc") rows.sort((a: any, b: any) => Number(b.price) - Number(a.price));
    else rows.sort((a: any, b: any) => Number(b.rating_avg ?? 0) - Number(a.rating_avg ?? 0));
    return rows;
  }, [dishes, category, search, sort]);

  const featured = dishes.filter((d: any) => d.is_featured || d.badge).slice(0, 6);
  const initials = seller.kitchen_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const gallery = Array.isArray((seller as any).gallery) ? ((seller as any).gallery as string[]) : [];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Banner */}
        <div className="relative h-48 overflow-hidden bg-secondary sm:h-72">
          {seller.banner_url || seller.cover_image_url ? (
            <img
              src={seller.banner_url ?? seller.cover_image_url ?? ""}
              alt={`${seller.kitchen_name} banner`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/20 via-secondary to-primary/5" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        {/* Header card */}
        <section className="container-page -mt-16 relative">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7">
            <div className="flex flex-wrap items-start gap-5">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-card bg-surface shadow sm:h-24 sm:w-24">
                {seller.logo_url ? (
                  <img src={seller.logo_url} alt={`${seller.kitchen_name} logo`} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-primary/10 text-2xl font-display text-primary">
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold sm:text-3xl">{seller.kitchen_name}</h1>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      seller.is_open ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${seller.is_open ? "bg-success" : "bg-muted-foreground"}`} />
                    {seller.is_open ? "Open now" : "Closed"}
                  </span>
                </div>
                {seller.cuisines && (seller.cuisines as string[]).length > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">{(seller.cuisines as string[]).join(" · ")}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    {Number(seller.rating_avg ?? 0).toFixed(1)}
                    <span className="text-muted-foreground">({seller.rating_count ?? 0} reviews)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4" /> ~{seller.prep_time_min_avg ?? 45} min
                  </span>
                  {seller.city && (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-4 w-4" /> {seller.city}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <ShoppingBag className="h-4 w-4" /> {data.totalOrders} delivered
                  </span>
                </div>
                {seller.description && (
                  <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{seller.description}</p>
                )}
                {seller.specialties && (seller.specialties as string[]).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(seller.specialties as string[]).map((s) => (
                      <span key={s} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Story */}
        {seller.story && (
          <section className="container-page py-8">
            <h2 className="font-display text-xl font-semibold">About this kitchen</h2>
            <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{seller.story}</p>
          </section>
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <section className="container-page py-8">
            <h2 className="font-display text-xl font-semibold">Gallery</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {gallery.map((url) => (
                <div key={url} className="aspect-square overflow-hidden rounded-xl bg-secondary">
                  <img src={url} alt="Kitchen" className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Featured items */}
        {featured.length > 0 && (
          <section className="container-page py-8">
            <h2 className="font-display text-xl font-semibold">Featured items</h2>
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((d: any) => (
                <div key={d.id} className="relative">
                  {d.badge && (() => {
                    const meta = BADGE_META[d.badge];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    return (
                      <span
                        className={`absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${meta.className}`}
                      >
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                    );
                  })()}
                  <DishCard dish={d} isOpen={seller.is_open ?? undefined} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Menu */}
        <section className="container-page py-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-semibold">Menu</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search menu"
                  className="h-10 w-56 rounded-full border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-ring"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="h-10 rounded-full border border-input bg-background px-3 text-sm"
              >
                <option value="popular">Popular</option>
                <option value="price_asc">Price: Low to high</option>
                <option value="price_desc">Price: High to low</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1">
            <CategoryPill active={category === "all"} label="All" onClick={() => setCategory("all")} />
            {categories.map((c) => (
              <CategoryPill key={c} active={category === c} label={c} onClick={() => setCategory(c)} />
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
              No dishes match your filters.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((d: any) => (
                <div key={d.id} className="relative">
                  {d.badge && (() => {
                    const meta = BADGE_META[d.badge];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    return (
                      <span
                        className={`absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${meta.className}`}
                      >
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                    );
                  })()}
                  <DishCard dish={d} isOpen={seller.is_open ?? undefined} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

function CategoryPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
