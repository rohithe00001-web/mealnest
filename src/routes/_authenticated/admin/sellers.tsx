import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X, PauseCircle, RotateCcw, Star } from "lucide-react";
import { listAdminSellers, updateSellerStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/sellers")({
  component: AdminSellers,
});

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
  { value: "all", label: "All" },
];

function AdminSellers() {
  const [status, setStatus] = useState("pending");
  const listFn = useServerFn(listAdminSellers);
  const updateFn = useServerFn(updateSellerStatus);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin", "sellers", status],
    queryFn: () => listFn({ data: { status } }),
  });
  const mut = useMutation({
    mutationFn: (vars: { sellerId: string; status: "approved" | "rejected" | "suspended" | "pending" }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  return (
    <div className="space-y-4">
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
          <p className="p-6 text-sm text-muted-foreground">No sellers in this view.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.map((s: any) => (
              <div key={s.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{s.kitchen_name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] capitalize ${
                        s.status === "approved"
                          ? "bg-success/15 text-success"
                          : s.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.profiles?.full_name ?? "Unnamed owner"} · {s.email ?? "no email"} · {s.phone}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.city} · Joined {new Date(s.created_at).toLocaleDateString()}
                  </p>
                  {s.rating_count > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-current text-amber-500" />
                      {Number(s.rating_avg).toFixed(1)} ({s.rating_count})
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.status !== "approved" && (
                    <button
                      disabled={mut.isPending}
                      onClick={() => mut.mutate({ sellerId: s.id, status: "approved" })}
                      className="inline-flex items-center gap-1 rounded-md bg-success px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                  )}
                  {s.status !== "rejected" && s.status === "pending" && (
                    <button
                      disabled={mut.isPending}
                      onClick={() => mut.mutate({ sellerId: s.id, status: "rejected" })}
                      className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  )}
                  {s.status === "approved" && (
                    <button
                      disabled={mut.isPending}
                      onClick={() => mut.mutate({ sellerId: s.id, status: "suspended" })}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      <PauseCircle className="h-3.5 w-3.5" /> Suspend
                    </button>
                  )}
                  {(s.status === "suspended" || s.status === "rejected") && (
                    <button
                      disabled={mut.isPending}
                      onClick={() => mut.mutate({ sellerId: s.id, status: "pending" })}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reset
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
