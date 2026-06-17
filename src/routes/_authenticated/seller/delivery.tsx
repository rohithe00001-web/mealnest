import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle, PauseCircle, Trash2 } from "lucide-react";
import { listSellerAgents, sellerApproveAgent, sellerSuspendAgent, sellerRemoveAgent } from "@/lib/delivery.functions";

export const Route = createFileRoute("/_authenticated/seller/delivery")({
  component: SellerDelivery,
});

function SellerDelivery() {
  const listFn = useServerFn(listSellerAgents);
  const approveFn = useServerFn(sellerApproveAgent);
  const suspendFn = useServerFn(sellerSuspendAgent);
  const removeFn = useServerFn(sellerRemoveAgent);
  const qc = useQueryClient();
  const { data: agents = [], isLoading } = useQuery({ queryKey: ["seller", "agents"], queryFn: () => listFn() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["seller", "agents"] });
  const approve = useMutation({ mutationFn: (v: { agent_id: string; approve: boolean }) => approveFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); invalidate(); }, onError: (e: any) => toast.error(e.message) });
  const suspend = useMutation({ mutationFn: (v: { agent_id: string; suspend: boolean }) => suspendFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); invalidate(); }, onError: (e: any) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: (v: { agent_id: string }) => removeFn({ data: v }),
    onSuccess: () => { toast.success("Removed"); invalidate(); }, onError: (e: any) => toast.error(e.message) });

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-semibold">Delivery agents</h2>
        <p className="text-sm text-muted-foreground">Approve agent applications, suspend or remove agents.</p>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : agents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No agents yet. Share <code>/delivery/register</code> with people who want to deliver for your kitchen.
        </div>
      ) : (
        <div className="grid gap-3">
          {agents.map((a: any) => (
            <div key={a.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{a.full_name}</p>
                  <p className="text-xs text-muted-foreground">{a.phone} · {a.vehicle_type || "—"} {a.vehicle_number}</p>
                  <p className="mt-1 text-xs">Aadhaar: {a.aadhaar_number || "—"} · License: {a.license_number || "—"}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge(a.status)}`}>{a.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.status === "pending_seller" && <>
                  <button onClick={() => approve.mutate({ agent_id: a.id, approve: true })}
                    className="inline-flex items-center gap-1 rounded-full bg-success px-3 py-1.5 text-xs font-medium text-white">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve & forward to admin
                  </button>
                  <button onClick={() => approve.mutate({ agent_id: a.id, approve: false })}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium">
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </>}
                {a.status === "approved" && (
                  <button onClick={() => suspend.mutate({ agent_id: a.id, suspend: true })}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs">
                    <PauseCircle className="h-3.5 w-3.5" /> Suspend
                  </button>
                )}
                {a.status === "suspended" && (
                  <button onClick={() => suspend.mutate({ agent_id: a.id, suspend: false })}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Reinstate
                  </button>
                )}
                <button onClick={() => confirm("Remove this agent?") && remove.mutate({ agent_id: a.id })}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function badge(s: string) {
  if (s === "approved") return "bg-success/10 text-success";
  if (s === "rejected") return "bg-destructive/10 text-destructive";
  if (s === "suspended") return "bg-muted text-muted-foreground";
  return "bg-warning/10 text-warning";
}
