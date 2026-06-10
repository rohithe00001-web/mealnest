import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listSellerOrders, updateSellerOrderStatus } from "@/lib/seller.functions";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seller/orders")({
  component: SellerOrders,
});

const NEXT: Record<string, { value: string; label: string }[]> = {
  placed: [{ value: "accepted", label: "Accept" }, { value: "rejected", label: "Reject" }],
  accepted: [{ value: "preparing", label: "Start cooking" }],
  preparing: [{ value: "ready", label: "Mark ready" }],
  ready: [{ value: "out_for_delivery", label: "Out for delivery" }],
  out_for_delivery: [{ value: "delivered", label: "Mark delivered" }],
};

const TABS = [
  { value: "all", label: "All" },
  { value: "placed", label: "New" },
  { value: "preparing", label: "Cooking" },
  { value: "out_for_delivery", label: "Out" },
  { value: "delivered", label: "Done" },
];

function SellerOrders() {
  const [status, setStatus] = useState("placed");
  const listFn = useServerFn(listSellerOrders);
  const updateFn = useServerFn(updateSellerOrderStatus);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["seller", "orders", status], queryFn: () => listFn({ data: { status } }) });
  const mut = useMutation({
    mutationFn: (v: { orderId: string; status: any }) => updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seller"] }),
  });

  useEffect(() => {
    const ch = supabase
      .channel("seller-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["seller", "orders"] });
        toast.success("New order received!");
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setStatus(t.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              status === t.value ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
            }`}>{t.label}</button>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-surface">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : data.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No orders in this view.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.map((o: any) => {
              const addr = (o.delivery_address ?? {}) as Record<string, string>;
              return (
                <div key={o.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{o.order_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{String(o.status).replace(/_/g, " ")}</span>
                      <span className="font-semibold">{inr(Number(o.total))}</span>
                    </div>
                  </div>
                  <ul className="text-sm text-muted-foreground">
                    {o.order_items.map((it: any) => (
                      <li key={it.id}>{it.dish_name} × {it.quantity}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Deliver to: {addr.addressLine}, {addr.city} · {addr.phone}
                  </p>
                  {NEXT[o.status] && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {NEXT[o.status].map((a) => (
                        <button key={a.value} disabled={mut.isPending}
                          onClick={() => mut.mutate({ orderId: o.id, status: a.value })}
                          className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-medium disabled:opacity-50 ${
                            a.value === "rejected" ? "bg-destructive text-white" : "bg-primary text-primary-foreground"
                          }`}>{a.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
