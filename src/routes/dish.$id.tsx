import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dishByIdQuery } from "@/lib/queries";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WishlistButton } from "@/components/WishlistButton";
import { inr } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { Clock, Star, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { listDishReviews } from "@/lib/customer.functions";

export const Route = createFileRoute("/dish/$id")({
  component: DishPage,
});

function DishPage() {
  const { id } = Route.useParams();
  const { data: dish, isLoading } = useQuery(dishByIdQuery(id));
  const { add } = useCart();
  const router = useRouter();
  const reviewsFn = useServerFn(listDishReviews);
  const { data: reviews } = useQuery({
    queryKey: ["dish-reviews", id],
    queryFn: () => reviewsFn({ data: { dishId: id } }),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8">
        <button onClick={() => router.history.back()} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        {isLoading ? (
          <div className="mt-6 h-96 animate-pulse rounded-3xl bg-muted" />
        ) : !dish ? (
          <p className="mt-10 text-center text-muted-foreground">Dish not found.</p>
        ) : (
          <>
            <div className="mt-6 grid gap-10 md:grid-cols-2">
              <div className="relative aspect-square overflow-hidden rounded-3xl bg-muted">
                {dish.image_url && <img src={dish.image_url} alt={dish.name} className="h-full w-full object-cover" />}
                <div className="absolute right-4 top-4">
                  <WishlistButton dishId={dish.id} size="lg" />
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{(dish as any).categories?.name}</p>
                <h1 className="mt-2 font-display text-4xl font-semibold">{dish.name}</h1>
                {(dish as any).sellers && (
                  <Link to="/" className="mt-2 inline-block text-sm text-primary hover:underline">
                    from {(dish as any).sellers.kitchen_name}
                  </Link>
                )}
                <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                  {dish.prep_time_min && <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{dish.prep_time_min}m</span>}
                  {Number(dish.rating_avg) > 0 && <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-current text-success" />{Number(dish.rating_avg).toFixed(1)} ({dish.rating_count})</span>}
                </div>
                {dish.description && <p className="mt-6 text-base text-muted-foreground leading-relaxed">{dish.description}</p>}
                {dish.ingredients && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold">Ingredients</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{dish.ingredients}</p>
                  </div>
                )}
                <div className="mt-8 flex items-center justify-between rounded-2xl border border-border bg-card p-5">
                  <span className="font-display text-3xl font-semibold">{inr(dish.price)}</span>
                  <button
                    onClick={() => {
                      add({ dishId: dish.id, sellerId: dish.seller_id, name: dish.name, price: Number(dish.price), imageUrl: dish.image_url });
                      toast.success("Added to cart");
                    }}
                    className="h-12 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Add to cart
                  </button>
                </div>
              </div>
            </div>

            <section className="mt-14">
              <h2 className="font-display text-2xl font-semibold">Reviews</h2>
              {!reviews || reviews.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No reviews yet. Be the first to review after ordering.</p>
              ) : (
                <ul className="mt-5 space-y-4">
                  {reviews.map((r) => (
                    <li key={r.id} className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.customer_name}</span>
                          <span className="inline-flex items-center gap-0.5 text-xs text-success">
                            {Array.from({ length: r.rating }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-current" />
                            ))}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
                      {r.seller_reply && (
                        <div className="mt-3 rounded-xl bg-muted/50 p-3 text-sm">
                          <p className="text-xs font-medium text-muted-foreground">Seller's reply</p>
                          <p className="mt-1">{r.seller_reply}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
