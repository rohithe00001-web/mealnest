import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";

const HIDE_PREFIXES = ["/cart", "/checkout", "/auth", "/admin", "/seller", "/delivery"];

export function FloatingCart() {
  const { count, subtotal } = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (count === 0) return null;
  if (HIDE_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return (
    <div
      className="fixed inset-x-0 z-30 px-3 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)" }}
    >
      <div className="lg:pl-16 mx-auto max-w-2xl">
        <Link
          to="/cart"
          className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl bg-foreground text-background px-4 py-3 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)] animate-[fade-in_0.2s_ease-out]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <ShoppingBag className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-background px-1 text-[10px] font-semibold text-foreground">
                {count}
              </span>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{count} item{count === 1 ? "" : "s"} · {inr(subtotal)}</p>
              <p className="truncate text-[11px] opacity-70">Tap to view cart</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium">
            View cart <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
