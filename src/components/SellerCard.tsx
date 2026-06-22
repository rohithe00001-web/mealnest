import { Link } from "@tanstack/react-router";
import { Star, Clock, MapPin } from "lucide-react";

type SellerCardData = {
  id: string;
  slug?: string | null;
  kitchen_name: string;
  description?: string | null;
  city?: string | null;
  rating_avg?: number | null;
  rating_count?: number | null;
  cover_image_url?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  cuisines?: string[] | null;
  is_open?: boolean | null;
  prep_time_min_avg?: number | null;
};

export function SellerCard({ seller }: { seller: SellerCardData }) {
  const handle = seller.slug ?? seller.id;
  const banner = seller.banner_url ?? seller.cover_image_url ?? null;
  const initials = seller.kitchen_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Link
      to="/store/$id"
      params={{ id: handle }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
        {banner ? (
          <img
            src={banner}
            alt={`${seller.kitchen_name} banner`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/10 to-secondary text-3xl font-display text-primary/70">
            {initials}
          </div>
        )}
        <span
          className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur ${
            seller.is_open
              ? "bg-success/90 text-white"
              : "bg-background/80 text-muted-foreground"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${seller.is_open ? "bg-white" : "bg-muted-foreground"}`} />
          {seller.is_open ? "Open" : "Closed"}
        </span>
      </div>
      <div className="flex flex-1 gap-3 p-4">
        <div className="-mt-10 h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 border-card bg-surface shadow-sm">
          {seller.logo_url ? (
            <img src={seller.logo_url} alt={`${seller.kitchen_name} logo`} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-primary/10 text-sm font-semibold text-primary">
              {initials}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold">{seller.kitchen_name}</h3>
          {seller.cuisines && seller.cuisines.length > 0 ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{seller.cuisines.slice(0, 3).join(" · ")}</p>
          ) : seller.city ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {seller.city}
            </p>
          ) : null}
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 font-medium">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
              {Number(seller.rating_avg ?? 0).toFixed(1)}
              <span className="text-muted-foreground">({seller.rating_count ?? 0})</span>
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {seller.prep_time_min_avg ?? 45} min
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
