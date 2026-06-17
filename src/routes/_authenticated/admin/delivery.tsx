import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, PauseCircle } from "lucide-react";
import { adminListAgents, adminApproveAgent, adminSuspendAgent } from "@/lib/delivery.functions";

export const Route = createFileRoute("/_authenticated/admin/delivery")({
  component: AdminDelivery,
});

const TABS = ["pending_admin", "approved", "pending_seller", "rejected", "suspended"] as const;
type Tab = typeof TABS[number];

function AdminDelivery() {
  const listFn = useServerFn(adminListAgents);
  const approveFn = useServerFn(adminApproveAgent);
  const suspendFn = useServerFn(adminSuspendAgent);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending_admin");
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["admin", "agents", tab],
    queryFn: () => listFn({ data: { status: tab } }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "agents"] });
  const approve = useMutation({ mutationFn: (v: { agent_id: string; approve: boolean }) => approveFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); invalidate(); }, onError: (e: any) => toast.error(e.message) });
  const suspend = useMutation({ mutationFn: (v: { agent_id: string; suspend: boolean }) => suspendFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); invalidate(); }, onError: (e: any) => toast.error(e.message) });

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-semibold">Delivery agent verification</h2>
        <p className="text-sm text-muted-foreground">Final approval for agents already approved by their seller.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${tab === t ? "bg-primary text-primary-foreground" : "border border-border"}`}>
            {t.replace("_", " ")}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : agents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No agents in this state.</div>
      ) : (
        <div className="grid gap-3">
          {agents.map((a: any) => (
            <div key={a.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{a.full_name} <span className="text-xs text-muted-foreground">· {a.sellers?.kitchen_name}</span></p>
                  <p className="text-xs text-muted-foreground">{a.phone} · {a.vehicle_type || "—"} {a.vehicle_number}</p>
                  <p className="mt-1 text-xs">Aadhaar: {a.aadhaar_number || "—"} · License: {a.license_number || "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Docs: {[a.id_doc_url, a.license_doc_url, a.vehicle_doc_url].filter(Boolean).length}/3 uploaded</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{a.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.status === "pending_admin" && <>
                  <button onClick={() => approve.mutate({ agent_id: a.id, approve: true })}
                    className="inline-flex items-center gap-1 rounded-full bg-success px-3 py-1.5 text-xs font-medium text-white">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Final approve
                  </button>
                  <button onClick={() => approve.mutate({ agent_id: a.id, approve: false })}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs">
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
