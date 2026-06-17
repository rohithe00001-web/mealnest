import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, UtensilsCrossed, ShoppingBag, Power, ArrowLeft, BarChart3, Calendar, Repeat, Truck } from "lucide-react";
import { Header } from "@/components/Header";
import { getSellerMe, updateSellerOpen } from "@/lib/seller.functions";

export const Route = createFileRoute("/_authenticated/seller")({
  component: SellerLayout,
});

const NAV = [
  { to: "/seller", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/seller/dishes", label: "Dishes", icon: UtensilsCrossed },
  { to: "/seller/orders", label: "Orders", icon: ShoppingBag },
  { to: "/seller/meal-plans", label: "Meal Plans", icon: Calendar },
  { to: "/seller/subscriptions", label: "Subscriptions", icon: Repeat },
  { to: "/seller/delivery", label: "Delivery", icon: Truck },
  { to: "/seller/analytics", label: "Analytics", icon: BarChart3 },
];

function SellerLayout() {
  const meFn = useServerFn(getSellerMe);
  const toggleFn = useServerFn(updateSellerOpen);
  const qc = useQueryClient();
  const { data: seller, isLoading } = useQuery({ queryKey: ["seller", "me"], queryFn: () => meFn(), staleTime: 30_000 });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const openMut = useMutation({
    mutationFn: (isOpen: boolean) => toggleFn({ data: { isOpen } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seller"] }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="container-page flex-1 py-16 text-muted-foreground">Loading…</main>
      </div>
    );
  }
  if (!seller) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="container-page flex-1 py-16">
          <div className="max-w-md rounded-2xl border border-border bg-surface p-8">
            <h1 className="font-display text-2xl font-semibold">Become a seller</h1>
            <p className="mt-2 text-sm text-muted-foreground">Apply to open your home kitchen on MealNest.</p>
            <Link to="/become-seller" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
              Start application
            </Link>
          </div>
        </main>
      </div>
    );
  }
  if (seller.status !== "approved") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="container-page flex-1 py-16">
          <div className="max-w-md rounded-2xl border border-border bg-surface p-8">
            <h1 className="font-display text-2xl font-semibold capitalize">Application {seller.status}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {seller.status === "pending"
                ? "Your kitchen is under review. We'll notify you once approved."
                : `Your kitchen is currently ${seller.status}. Contact support for next steps.`}
            </p>
            <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="container-page flex-1 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Seller</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">{seller.kitchen_name}</h1>
          </div>
          <button
            onClick={() => openMut.mutate(!seller.is_open)}
            disabled={openMut.isPending}
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-50 ${
              seller.is_open ? "bg-success text-white" : "border border-border bg-surface text-muted-foreground"
            }`}
          >
            <Power className="h-4 w-4" />
            {seller.is_open ? "Open for orders" : "Closed"}
          </button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <nav className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-2 lg:flex-col">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <section className="min-w-0">
            <Outlet />
          </section>
        </div>
      </div>
    </div>
  );
}
