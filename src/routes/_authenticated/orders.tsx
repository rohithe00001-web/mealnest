import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { myOrdersQuery } from "@/lib/queries";
import { inr } from "@/lib/format";

const STATUS_COLORS: Record<string, string> = {
  placed: "bg-accent/30 text-accent-foreground",
  accepted: "bg-accent/40 text-accent-foreground",
  preparing: "bg-primary/15 text-primary",
  ready: "bg-primary/20 text-primary",
  out_for_delivery: "bg-primary/25 text-primary",
  delivered: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
  rejected: "bg-destructive/15 text-destructive",
};

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  const { data: orders = [], isLoading } = useQuery(myOrdersQuery);
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">My orders</h1>
        {isLoading ? (
          <div className="mt-6 h-40 animate-pulse rounded-2xl bg-muted" />
        ) : orders.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
            <p className="font-display text-xl">No orders yet</p>
            <Link to="/browse" className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Order something</Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {orders.map((o: any) => (
              <li key={o.id}>
                <Link to="/orders/$id" params={{ id: o.id }} className="block rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{o.order_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()} · {o.sellers?.kitchen_name}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_COLORS[o.status] ?? "bg-muted text-muted-foreground"}`}>
                      {String(o.status).replace(/_/g, " ")}
                    </span>
                  </div>
                  <ul className="mt-3 text-sm text-muted-foreground">
                    {o.order_items.map((it: any) => (
                      <li key={it.id} className="flex justify-between"><span>{it.dish_name} × {it.quantity}</span><span>{inr(it.line_total)}</span></li>
                    ))}
                  </ul>
                  <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold">
                    <span>Total</span><span>{inr(o.total)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
