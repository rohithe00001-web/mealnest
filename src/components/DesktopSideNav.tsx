import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, ShoppingBag, CalendarDays, User as UserIcon, Heart, Sparkles, MapPin } from "lucide-react";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/browse", label: "Search", icon: Search, match: (p: string) => p.startsWith("/browse") },
  { to: "/cart", label: "Cart", icon: ShoppingBag, match: (p: string) => p.startsWith("/cart") || p.startsWith("/checkout") },
  { to: "/my-subscriptions", label: "Plans", icon: CalendarDays, match: (p: string) => p.startsWith("/my-subscriptions") || p.startsWith("/meal-plans") },
  { to: "/wishlist", label: "Wishlist", icon: Heart, match: (p: string) => p.startsWith("/wishlist") },
  { to: "/rewards", label: "Rewards", icon: Sparkles, match: (p: string) => p.startsWith("/rewards") },
  { to: "/addresses", label: "Addresses", icon: MapPin, match: (p: string) => p.startsWith("/addresses") },
  { to: "/profile", label: "Profile", icon: UserIcon, match: (p: string) => p.startsWith("/profile") },
] as const;

export function DesktopSideNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { count } = useCart();
  return (
    <aside
      aria-label="Sidebar"
      className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 w-16 flex-col items-center border-r border-border/70 bg-background/95 backdrop-blur py-4"
    >
      <Link to="/" className="block" aria-label="MealNest home">
        <LogoMark className="h-10 w-10" />
      </Link>
      <ul className="mt-6 flex flex-1 flex-col gap-1">
        {items.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          const showBadge = it.to === "/cart" && count > 0;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                aria-label={it.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative grid h-11 w-11 place-items-center rounded-xl transition-all",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {active && <span aria-hidden className="absolute -left-4 h-6 w-1 rounded-r-full bg-primary" />}
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                {showBadge && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {count}
                  </span>
                )}
                <span className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100">
                  {it.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
