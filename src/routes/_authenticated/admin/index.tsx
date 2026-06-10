import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Users, Store, ShoppingBag, IndianRupee, Clock, CheckCircle2 } from "lucide-react";
import { getAdminStats } from "@/lib/admin.functions";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const fn = useServerFn(getAdminStats);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "stats"], queryFn: () => fn() });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Loading stats…</p>;
  }

  const t = data.totals;
  const cards = [
    { label: "Total revenue", value: inr(t.revenue), icon: IndianRupee, accent: "text-success" },
    { label: "Total orders", value: t.orders.toLocaleString(), icon: ShoppingBag, accent: "text-primary" },
    { label: "Delivered", value: t.ordersDelivered.toLocaleString(), icon: CheckCircle2, accent: "text-success" },
    { label: "Customers", value: t.users.toLocaleString(), icon: Users, accent: "text-foreground" },
    { label: "Kitchens", value: `${t.sellersApproved}/${t.sellers}`, icon: Store, accent: "text-foreground" },
    { label: "Pending approvals", value: t.sellersPending.toLocaleString(), icon: Clock, accent: "text-amber-600" },
  ];

  const last7 = data.daily.slice(-7);
  const maxRev = Math.max(1, ...last7.map((d) => d.revenue));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <Icon className={`h-4 w-4 ${c.accent}`} />
              </div>
              <p className="mt-2 font-display text-2xl font-semibold">{c.value}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-semibold">Last 7 days</h2>
        <div className="mt-4 flex items-end gap-3 h-40">
          {last7.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
          {last7.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-md bg-primary/80"
                style={{ height: `${(d.revenue / maxRev) * 100}%`, minHeight: d.revenue > 0 ? 4 : 0 }}
                title={`${inr(d.revenue)} · ${d.orders} orders`}
              />
              <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Recent orders</h2>
        </div>
        <div className="divide-y divide-border">
          {data.recentOrders.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">No orders yet.</p>
          )}
          {data.recentOrders.map((o: any) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <p className="font-medium">{o.order_number}</p>
                <p className="text-xs text-muted-foreground">
                  {o.sellers?.kitchen_name ?? "—"} · {new Date(o.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{o.status.replace(/_/g, " ")}</span>
                <span className="font-medium">{inr(Number(o.total))}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
