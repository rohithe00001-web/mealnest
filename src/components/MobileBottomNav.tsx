import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, ShoppingBag, CalendarDays, User as UserIcon } from "lucide-react";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/browse", label: "Search", icon: Search, match: (p: string) => p.startsWith("/browse") },
  { to: "/cart", label: "Cart", icon: ShoppingBag, match: (p: string) => p.startsWith("/cart") || p.startsWith("/checkout") },
  { to: "/my-subscriptions", label: "Plans", icon: CalendarDays, match: (p: string) => p.startsWith("/my-subscriptions") || p.startsWith("/meal-plans") },
  { to: "/profile", label: "Profile", icon: UserIcon, match: (p: string) => p.startsWith("/profile") || p.startsWith("/orders") || p.startsWith("/addresses") || p.startsWith("/rewards") || p.startsWith("/wishlist") || p.startsWith("/devices") },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { count } = useCart();
  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[max(env(safe-area-inset-bottom),0px)]"
    >
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          const showBadge = it.to === "/cart" && count > 0;
          return (
            <li key={it.to} className="flex">
              <Link
                to={it.to}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-14"
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute -top-px h-1 w-10 rounded-b-full bg-primary transition-all"
                  />
                )}
                <span
                  className={cn(
                    "relative grid h-8 w-8 place-items-center rounded-full transition-all",
                    active ? "bg-primary/10 text-primary scale-110" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
                  {showBadge && (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {count}
                    </span>
                  )}
                </span>
                <span className={cn("text-[10px] font-medium leading-none", active ? "text-primary" : "text-muted-foreground")}>
                  {it.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
