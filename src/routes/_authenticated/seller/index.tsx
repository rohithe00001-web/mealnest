import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee, ShoppingBag, Clock, UtensilsCrossed } from "lucide-react";
import { getSellerStats } from "@/lib/seller.functions";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/seller/")({
  component: SellerDashboard,
});

function SellerDashboard() {
  const fn = useServerFn(getSellerStats);
  const { data, isLoading } = useQuery({ queryKey: ["seller", "stats"], queryFn: () => fn() });
  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;
  const t = data.totals;
  const cards = [
    { label: "Today's revenue", value: inr(t.todayRevenue), icon: IndianRupee },
    { label: "Total revenue", value: inr(t.revenue), icon: IndianRupee },
    { label: "Active orders", value: t.activeOrders, icon: Clock },
    { label: "Total orders", value: t.totalOrders, icon: ShoppingBag },
    { label: "Dishes", value: t.dishes, icon: UtensilsCrossed },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 font-display text-2xl font-semibold">{c.value}</p>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4"><h2 className="font-display text-lg font-semibold">Recent orders</h2></div>
        <div className="divide-y divide-border">
          {data.recentOrders.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">No orders yet.</p>}
          {data.recentOrders.map((o: any) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <p className="font-medium">{o.order_number}</p>
                <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{String(o.status).replace(/_/g, " ")}</span>
                <span className="font-medium">{inr(Number(o.total))}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
