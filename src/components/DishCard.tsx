import { Link } from "@tanstack/react-router";
import { Clock, Star, Plus, Lock } from "lucide-react";
import { inr } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";
import { WishlistButton } from "@/components/WishlistButton";

export interface DishCardData {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  prep_time_min?: number | null;
  image_url?: string | null;
  is_veg?: boolean;
  rating_avg?: number | string | null;
  rating_count?: number | null;
  seller_id: string;
  sellers?: { kitchen_name?: string | null; city?: string | null; is_open?: boolean | null } | null;
}

export function DishCard({ dish, isOpen }: { dish: DishCardData; isOpen?: boolean }) {
  const { add } = useCart();
  const price = Number(dish.price);
  const rating = Number(dish.rating_avg ?? 0);
  const open = isOpen ?? dish.sellers?.is_open;
  const closed = open === false;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
      <Link
        to="/dish/$id"
        params={{ id: dish.id }}
        className="relative block aspect-[4/3] overflow-hidden bg-muted"
      >
        {dish.image_url ? (
          <img
            src={dish.image_url}
            alt={dish.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">No image</div>
        )}
        <span className={`absolute left-3 top-3 grid h-5 w-5 place-items-center rounded-sm border-2 ${dish.is_veg ? "border-success" : "border-destructive"} bg-card`}>
          <span className={`h-2 w-2 rounded-full ${dish.is_veg ? "bg-success" : "bg-destructive"}`} />
        </span>
        <div className="absolute right-3 top-3">
          <WishlistButton dishId={dish.id} />
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-semibold leading-tight">{dish.name}</h3>
            {dish.sellers?.kitchen_name && (
              <p className="truncate text-xs text-muted-foreground mt-0.5">
                from {dish.sellers.kitchen_name}
                {dish.sellers.city ? ` · ${dish.sellers.city}` : ""}
              </p>
            )}
          </div>
          {rating > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">
              <Star className="h-3 w-3 fill-current" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
        {dish.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{dish.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">{inr(price)}</span>
            {dish.prep_time_min ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {dish.prep_time_min}m
              </span>
            ) : null}
          </div>
          <button
            onClick={() => {
              add({ dishId: dish.id, sellerId: dish.seller_id, name: dish.name, price, imageUrl: dish.image_url ?? null });
              toast.success(`Added ${dish.name} to cart`);
            }}
            className="inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>
    </article>
  );
}
