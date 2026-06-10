import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DishCard } from "@/components/DishCard";
import { categoriesQuery, dishesQuery } from "@/lib/queries";
import { useState } from "react";
import { Search } from "lucide-react";

const searchSchema = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/browse")({
  validateSearch: searchSchema,
  component: BrowsePage,
});

function BrowsePage() {
  const { category, q } = Route.useSearch();
  const [search, setSearch] = useState(q ?? "");
  const { data: cats } = useSuspenseQuery(categoriesQuery);
  const { data: dishes = [], isLoading } = useQuery(dishesQuery({ categorySlug: category, search }));

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Browse</h1>
        <div className="mt-5 flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dishes…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/browse" className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${!category ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:bg-muted"}`}>All</Link>
          {cats.map((c) => (
            <Link
              key={c.id}
              to="/browse"
              search={{ category: c.slug }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${category === c.slug ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:bg-muted"}`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />)}
            </div>
          ) : dishes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted-foreground">No dishes match. Try another filter.</p>
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
