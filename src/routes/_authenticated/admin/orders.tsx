import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { listAdminOrders, updateOrderStatusAdmin } from "@/lib/admin.functions";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrders,
});

const STATUS_OPTIONS = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "rejected",
] as const;

const TABS = [
  { value: "all", label: "All" },
  { value: "placed", label: "New" },
  { value: "preparing", label: "Preparing" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

function AdminOrders() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const listFn = useServerFn(listAdminOrders);
  const updateFn = useServerFn(updateOrderStatusAdmin);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin", "orders", status, search],
    queryFn: () => listFn({ data: { status, search } }),
  });
  const mut = useMutation({
    mutationFn: (vars: { orderId: string; status: (typeof STATUS_OPTIONS)[number] }) =>
      updateFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order # (HB-...)"
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatus(t.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              status === t.value
                ? "bg-primary text-primary-foreground"
                : "bg-surface text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : data.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No orders found.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.map((o: any) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.profiles?.full_name ?? "Guest"} → {o.sellers?.kitchen_name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()} · {o.payment_method.toUpperCase()} ·{" "}
                    <span className="capitalize">{o.payment_status}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{inr(Number(o.total))}</span>
                  <select
                    value={o.status}
                    onChange={(e) =>
                      mut.mutate({ orderId: o.id, status: e.target.value as (typeof STATUS_OPTIONS)[number] })
                    }
                    disabled={mut.isPending}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
