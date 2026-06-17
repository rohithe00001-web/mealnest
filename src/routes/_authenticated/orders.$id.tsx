import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Star, MapPin, Phone } from "lucide-react";
import { Header } from "@/components/Header";
import { LiveMap } from "@/components/LiveMap";
import { Footer } from "@/components/Footer";
import { getOrderDetail, submitReview } from "@/lib/customer.functions";
import { customerGetAssignment } from "@/lib/delivery.functions";
import { inr } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  component: OrderDetailPage,
});

const STEPS = [
  { key: "placed", label: "Order placed" },
  { key: "accepted", label: "Accepted by kitchen" },
  { key: "preparing", label: "Being cooked" },
  { key: "ready", label: "Ready" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
] as const;

function OrderDetailPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getOrderDetail);
  const asgFn = useServerFn(customerGetAssignment);
  const qc = useQueryClient();
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fn({ data: { orderId: id } }),
  });
  const { data: assignment } = useQuery({
    queryKey: ["order", id, "assignment"],
    queryFn: () => asgFn({ data: { order_id: id } }),
    refetchInterval: 15_000,
  });

  // Realtime: refetch when this order updates
  useEffect(() => {
    const ch = supabase
      .channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["order", id] });
        toast.success("Order updated");
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="container-page flex-1 py-8">Loading…</main>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="container-page flex-1 py-16 text-center text-muted-foreground">Order not found.</main>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.key === order.status);
  const cancelled = order.status === "cancelled" || order.status === "rejected";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8">
        <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> My orders
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Order</p>
            <h1 className="font-display text-3xl font-semibold">{order.order_number}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(order.created_at).toLocaleString()} · {order.sellers?.kitchen_name}
            </p>
          </div>
          <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium capitalize text-primary">
            {String(order.status).replace(/_/g, " ")}
          </span>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-lg font-semibold">Tracking</h2>
              {cancelled ? (
                <p className="mt-4 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
                  This order was {order.status}.
                </p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {STEPS.map((s, i) => {
                    const done = i <= currentIdx;
                    const active = i === currentIdx;
                    return (
                      <li key={s.key} className="flex items-center gap-3">
                        {done ? (
                          <CheckCircle2 className={`h-5 w-5 ${active ? "text-primary animate-pulse" : "text-success"}`} />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/40" />
                        )}
                        <span className={`text-sm ${done ? "font-medium" : "text-muted-foreground"}`}>{s.label}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-lg font-semibold">Items</h2>
              <ul className="mt-3 divide-y divide-border">
                {order.order_items.map((it: any) => (
                  <li key={it.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span>
                      {it.dish_name} <span className="text-muted-foreground">× {it.quantity}</span>
                    </span>
                    <span className="font-medium">{inr(Number(it.line_total))}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                <Row label="Subtotal" value={inr(Number(order.subtotal))} />
                <Row label="Delivery" value={Number(order.delivery_fee) === 0 ? "Free" : inr(Number(order.delivery_fee))} />
                <Row label="Total" value={inr(Number(order.total))} bold />
                <Row label="Payment" value={`${String(order.payment_method).toUpperCase()} · ${order.payment_status}`} />
              </dl>
            </div>

            {order.status === "delivered" && <ReviewForm order={order} />}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface p-5 text-sm">
              <h3 className="font-display text-base font-semibold">Delivery</h3>
              {(() => {
                const a = (order.delivery_address ?? {}) as Record<string, string>;
                return (
                  <>
                    <p className="mt-2 inline-flex items-start gap-2 text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4" />
                      <span>
                        {a.addressLine}
                        <br />
                        {a.city}
                        {a.pincode ? ` · ${a.pincode}` : ""}
                      </span>
                    </p>
                    {a.phone && (
                      <p className="mt-2 inline-flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" /> {a.phone}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5 text-sm">
              <h3 className="font-display text-base font-semibold">Kitchen</h3>
              <p className="mt-2 font-medium">{order.sellers?.kitchen_name}</p>
              <p className="text-muted-foreground">{order.sellers?.city}</p>
              {order.sellers?.phone && (
                <p className="mt-1 inline-flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> {order.sellers.phone}
                </p>
              )}
            </div>
            {assignment && (
              <div className="rounded-2xl border border-border bg-surface p-5 text-sm">
                <h3 className="font-display text-base font-semibold">Delivery agent</h3>
                <p className="mt-2 font-medium">{(assignment as any).delivery_agents?.full_name ?? "—"}</p>
                <p className="text-xs capitalize text-muted-foreground">Status: {String(assignment.status).replace("_", " ")}</p>
                {(assignment as any).delivery_agents?.phone && (
                  <p className="mt-1 inline-flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <a href={`tel:${(assignment as any).delivery_agents.phone}`} className="hover:underline">{(assignment as any).delivery_agents.phone}</a>
                  </p>
                )}
                {assignment.status === "picked_up" && (
                  <p className="mt-3 rounded-lg bg-primary/10 p-3 text-xs text-primary">
                    Share this OTP with the agent on delivery: <span className="text-base font-bold tracking-widest">{assignment.otp}</span>
                  </p>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "border-t border-border pt-2 font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ReviewForm({ order }: { order: any }) {
  const reviewFn = useServerFn(submitReview);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const mut = useMutation({
    mutationFn: (v: { dishId: string }) =>
      reviewFn({
        data: { dishId: v.dishId, sellerId: order.sellers.id, orderId: order.id, rating, comment },
      }),
    onSuccess: () => {
      toast.success("Thanks for the review!");
      setActiveItem(null);
      setComment("");
      setRating(5);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-lg font-semibold">Rate your dishes</h2>
      <ul className="mt-3 space-y-3">
        {order.order_items.map((it: any) => (
          <li key={it.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{it.dish_name}</p>
              {activeItem !== it.dish_id && (
                <button
                  onClick={() => {
                    setActiveItem(it.dish_id);
                    setRating(5);
                    setComment("");
                  }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Write a review
                </button>
              )}
            </div>
            {activeItem === it.dish_id && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      aria-label={`${n} stars`}
                      className="p-0.5"
                    >
                      <Star className={`h-5 w-5 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What did you think?"
                  className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-ring"
                  rows={3}
                  maxLength={800}
                />
                <div className="flex gap-2">
                  <button
                    disabled={mut.isPending}
                    onClick={() => mut.mutate({ dishId: it.dish_id })}
                    className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {mut.isPending ? "Posting…" : "Post review"}
                  </button>
                  <button
                    onClick={() => setActiveItem(null)}
                    className="inline-flex h-9 items-center rounded-full border border-border px-4 text-xs font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
