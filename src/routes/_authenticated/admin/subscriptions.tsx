import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { adminListAllPlans, adminUpdatePlanStatus, adminSubscriptionStats } from "@/lib/subscriptions.functions";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  component: AdminSubs,
});

function AdminSubs() {
  const plansFn = useServerFn(adminListAllPlans);
  const statsFn = useServerFn(adminSubscriptionStats);
  const updFn = useServerFn(adminUpdatePlanStatus);
  const qc = useQueryClient();
  const { data: plans = [] } = useQuery({ queryKey: ["admin", "sub-plans"], queryFn: () => plansFn() });
  const { data: stats } = useQuery({ queryKey: ["admin", "sub-stats"], queryFn: () => statsFn() });
  const updMut = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" }) => updFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin", "sub-plans"] }); },
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total subs" value={String(stats?.total ?? 0)} />
        <Stat label="Active" value={String(stats?.active ?? 0)} />
        <Stat label="Revenue" value={inr(stats?.revenue ?? 0)} />
        <Stat label="Retention" value={`${stats?.retention ?? 0}%`} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Weekly" value={String(stats?.byType?.weekly ?? 0)} />
        <Stat label="15-day" value={String(stats?.byType?.half_month ?? 0)} />
        <Stat label="Monthly" value={String(stats?.byType?.monthly ?? 0)} />
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border p-4 font-medium">All meal plans</div>
        {plans.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No plans yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {(plans as any[]).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.sellers?.kitchen_name} · {p.plan_type.replace("_", " ")} · {p.duration_days}d · {inr(Number(p.price_per_person))}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                  p.status === "pending" ? "bg-amber-100 text-amber-800" :
                  p.status === "rejected" ? "bg-rose-100 text-rose-800" : "bg-muted text-muted-foreground"
                }`}>{p.status}</span>
                {p.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => updMut.mutate({ id: p.id, status: "approved" })}
                      className="inline-flex h-9 items-center gap-1 rounded-full bg-success px-3 text-xs text-white">
                      <Check className="h-3 w-3" /> Approve
                    </button>
                    <button onClick={() => updMut.mutate({ id: p.id, status: "rejected" })}
                      className="inline-flex h-9 items-center gap-1 rounded-full border border-destructive px-3 text-xs text-destructive">
                      <X className="h-3 w-3" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
    </div>
  );
}
