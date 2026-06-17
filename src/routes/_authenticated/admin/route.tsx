import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Store, ShoppingBag, Users, ArrowLeft, Calendar, Truck, Ticket, Sparkles, BarChart3, ShieldAlert } from "lucide-react";
import { checkIsAdmin } from "@/lib/admin.functions";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/sellers", label: "Sellers", icon: Store },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: Calendar },
  { to: "/admin/delivery", label: "Delivery", icon: Truck },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/campaigns", label: "Campaigns", icon: Sparkles },
  { to: "/admin/promotions", label: "Promo analytics", icon: BarChart3 },
  { to: "/admin/abuse", label: "Abuse reports", icon: ShieldAlert },
  { to: "/admin/users", label: "Users", icon: Users },
];

function AdminLayout() {
  const check = useServerFn(checkIsAdmin);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "is-admin"],
    queryFn: () => check(),
    staleTime: 60_000,
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="container-page flex-1 py-16 text-muted-foreground">Loading admin…</main>
      </div>
    );
  }
  if (!data?.isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="container-page flex-1 py-16">
          <div className="max-w-md rounded-2xl border border-border bg-surface p-8">
            <h1 className="font-display text-2xl font-semibold">Admins only</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You don't have permission to view the admin panel.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
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
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">MealNest</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">Admin panel</h1>
          </div>
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
