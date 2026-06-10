import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { listWishlist, toggleWishlist } from "@/lib/customer.functions";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/wishlist")({
  component: WishlistPage,
});

function WishlistPage() {
  const listFn = useServerFn(listWishlist);
  const toggleFn = useServerFn(toggleWishlist);
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => listFn(),
  });
  const remove = useMutation({
    mutationFn: (dishId: string) => toggleFn({ data: { dishId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl flex items-center gap-2">
          <Heart className="h-7 w-7 fill-current text-primary" /> Wishlist
        </h1>
        {isLoading ? (
          <p className="mt-8 text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">No saved dishes yet.</p>
            <Link to="/browse" className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
              Browse dishes
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((w: any) => {
              const d = w.dishes;
              if (!d) return null;
              return (
                <li key={w.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <Link to="/dish/$id" params={{ id: d.id }} className="block aspect-[4/3] bg-muted">
                    {d.image_url && <img src={d.image_url} alt={d.name} className="h-full w-full object-cover" />}
                  </Link>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link to="/dish/$id" params={{ id: d.id }} className="font-medium hover:underline">
                          {d.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{d.sellers?.kitchen_name}</p>
                      </div>
                      <button
                        onClick={() => remove.mutate(d.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 font-display text-lg font-semibold">{inr(Number(d.price))}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
