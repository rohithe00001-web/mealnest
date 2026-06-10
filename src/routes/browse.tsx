import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DishCard } from "@/components/DishCard";
import { categoriesQuery, dishesQuery } from "@/lib/queries";
import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, X, Star } from "lucide-react";

const searchSchema = z.object({
  category: fallback(z.string(), "").default(""),
  q: fallback(z.string(), "").default(""),
  veg: fallback(z.enum(["all", "veg", "nonveg"]), "all").default("all"),
  minPrice: fallback(z.coerce.number().int().min(0), 0).default(0),
  maxPrice: fallback(z.coerce.number().int().min(0), 1000).default(1000),
  minRating: fallback(z.coerce.number().min(0).max(5), 0).default(0),
  openNow: fallback(z.coerce.boolean(), false).default(false),
  sort: fallback(z.enum(["newest", "price_asc", "price_desc", "rating"]), "newest").default("newest"),
});

export const Route = createFileRoute("/browse")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Browse home-cooked dishes — HomeBite" },
      { name: "description", content: "Search dishes and home kitchens by cuisine, veg/non-veg, price, and rating. Open now and ready to deliver." },
      { property: "og:title", content: "Browse home-cooked dishes — HomeBite" },
      { property: "og:description", content: "Find homemade meals from neighborhood kitchens, ready to deliver." },
    ],
  }),
  component: BrowsePage,
});

function BrowsePage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/browse" });
  const [search, setSearch] = useState(s.q);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== s.q) navigate({ search: (p: any) => ({ ...p, q: search }) });
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: cats } = useSuspenseQuery(categoriesQuery);
  const { data: dishes = [], isLoading } = useQuery(
    dishesQuery({
      categorySlug: s.category || undefined,
      search: s.q || undefined,
      veg: s.veg,
      minPrice: s.minPrice,
      maxPrice: s.maxPrice,
      minRating: s.minRating || undefined,
      openNow: s.openNow,
      sort: s.sort,
    }),
  );

  const activeFilters =
    (s.veg !== "all" ? 1 : 0) +
    (s.minPrice > 0 ? 1 : 0) +
    (s.maxPrice < 1000 ? 1 : 0) +
    (s.minRating > 0 ? 1 : 0) +
    (s.openNow ? 1 : 0);

  const reset = () =>
    navigate({
      search: { category: s.category, q: s.q, veg: "all", minPrice: 0, maxPrice: 1000, minRating: 0, openNow: false, sort: "newest" },
    });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Browse</h1>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes or kitchens…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select
            value={s.sort}
            onChange={(e) => navigate({ search: (p: any) => ({ ...p, sort: e.target.value as any }) })}
            className="h-11 rounded-full border border-border bg-surface px-4 text-sm outline-none"
          >
            <option value="newest">Newest</option>
            <option value="rating">Top rated</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilters > 0 && (
              <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-5 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Diet</p>
                <div className="flex gap-2">
                  {(["all", "veg", "nonveg"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => navigate({ search: (p: any) => ({ ...p, veg: v }) })}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium border ${s.veg === v ? "bg-foreground text-background border-foreground" : "bg-surface border-border hover:bg-muted"}`}
                    >
                      {v === "all" ? "All" : v === "veg" ? "Veg" : "Non-veg"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Min rating</p>
                <div className="flex flex-wrap gap-1">
                  {[0, 3, 3.5, 4, 4.5].map((r) => (
                    <button
                      key={r}
                      onClick={() => navigate({ search: (p: any) => ({ ...p, minRating: r }) })}
                      className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-1.5 text-xs font-medium border ${s.minRating === r ? "bg-foreground text-background border-foreground" : "bg-surface border-border hover:bg-muted"}`}
                    >
                      {r === 0 ? "Any" : <>{r}<Star className="h-3 w-3 fill-current" /></>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Price range (₹)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={s.maxPrice} value={s.minPrice}
                    onChange={(e) => navigate({ search: (p: any) => ({ ...p, minPrice: Number(e.target.value) || 0 }) })}
                    className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-ring"
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <input
                    type="number" min={s.minPrice} value={s.maxPrice}
                    onChange={(e) => navigate({ search: (p: any) => ({ ...p, maxPrice: Number(e.target.value) || 0 }) })}
                    className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-ring"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox" checked={s.openNow}
                    onChange={(e) => navigate({ search: (p: any) => ({ ...p, openNow: e.target.checked }) })}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  Open now
                </label>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={reset} className="text-xs font-medium text-primary hover:underline">Reset filters</button>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => navigate({ search: (p: any) => ({ ...p, category: "" }) })}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${!s.category ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:bg-muted"}`}
          >
            All
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate({ search: (p: any) => ({ ...p, category: c.slug }) })}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${s.category === c.slug ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:bg-muted"}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="mt-2 text-xs text-muted-foreground">{dishes.length} dish{dishes.length === 1 ? "" : "es"}</div>

        <div className="mt-4">
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />)}
            </div>
          ) : dishes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">
              No dishes match. <button onClick={reset} className="text-primary hover:underline">Reset filters</button>
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {dishes.map((d: any) => <DishCard key={d.id} dish={d} />)}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
