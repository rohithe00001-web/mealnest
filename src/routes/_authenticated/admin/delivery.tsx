import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, PauseCircle, ShieldAlert, Users, MapPin, Radio, BarChart3, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LiveMap } from "@/components/LiveMap";
import {
  adminListAgents, adminApproveAgent, adminSuspendAgent,
  adminListZones, adminApproveZone, adminDeliveryCompliance,
  adminLiveAssignments, adminDeliveryAnalytics, adminCancelAssignment,
} from "@/lib/delivery.functions";

export const Route = createFileRoute("/_authenticated/admin/delivery")({
  component: AdminDelivery,
});

const TABS = [
  { id: "agents", label: "Agents", icon: Users },
  { id: "monitoring", label: "Live monitoring", icon: Radio },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "zones", label: "Zones", icon: MapPin },
  { id: "compliance", label: "Compliance", icon: ShieldAlert },
] as const;
type TabId = typeof TABS[number]["id"];

function AdminDelivery() {
  const [tab, setTab] = useState<TabId>("agents");
  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-semibold">Delivery oversight</h2>
        <p className="text-sm text-muted-foreground">Approve agents, zones, and monitor compliance across all sellers.</p>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                tab === t.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted"
              }`}>
              <Icon className="h-4 w-4" />{t.label}
            </button>
          );
        })}
      </div>
      {tab === "agents" && <AgentsTab />}
      {tab === "monitoring" && <MonitoringTab />}
      {tab === "analytics" && <AnalyticsTab />}
      {tab === "zones" && <ZonesTab />}
      {tab === "compliance" && <ComplianceTab />}
    </div>
  );
}

const STATUS_TABS = ["pending_admin", "approved", "pending_seller", "rejected", "suspended"] as const;
type Status = typeof STATUS_TABS[number];

function AgentsTab() {
  const listFn = useServerFn(adminListAgents);
  const approveFn = useServerFn(adminApproveAgent);
  const suspendFn = useServerFn(adminSuspendAgent);
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("pending_admin");
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["admin", "agents", status],
    queryFn: () => listFn({ data: { status } }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "agents"] });
  const approve = useMutation({ mutationFn: (v: { agent_id: string; approve: boolean }) => approveFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); invalidate(); }, onError: (e: any) => toast.error(e.message) });
  const suspend = useMutation({ mutationFn: (v: { agent_id: string; suspend: boolean }) => suspendFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); invalidate(); }, onError: (e: any) => toast.error(e.message) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button key={t} onClick={() => setStatus(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${status === t ? "bg-primary text-primary-foreground" : "border border-border"}`}>
            {t.replace("_", " ")}
          </button>
        ))}
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
       agents.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No agents.</div> :
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
                 <button onClick={() => approve.mutate({ agent_id: a.id, approve: true })} className="inline-flex items-center gap-1 rounded-full bg-success px-3 py-1.5 text-xs font-medium text-white">
                   <CheckCircle2 className="h-3.5 w-3.5" /> Final approve
                 </button>
                 <button onClick={() => approve.mutate({ agent_id: a.id, approve: false })} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs">
                   <XCircle className="h-3.5 w-3.5" /> Reject
                 </button>
               </>}
               {a.status === "approved" && (
                 <button onClick={() => suspend.mutate({ agent_id: a.id, suspend: true })} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs">
                   <PauseCircle className="h-3.5 w-3.5" /> Suspend
                 </button>
               )}
               {a.status === "suspended" && (
                 <button onClick={() => suspend.mutate({ agent_id: a.id, suspend: false })} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs">
                   <CheckCircle2 className="h-3.5 w-3.5" /> Reinstate
                 </button>
               )}
             </div>
           </div>
         ))}
       </div>
      }
    </div>
  );
}

function ZonesTab() {
  const listFn = useServerFn(adminListZones);
  const approveFn = useServerFn(adminApproveZone);
  const qc = useQueryClient();
  const [pendingOnly, setPendingOnly] = useState(true);
  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["admin", "zones", pendingOnly],
    queryFn: () => listFn({ data: { pending_only: pendingOnly } }),
  });
  const approve = useMutation({
    mutationFn: (v: { id: string; approve: boolean; reason?: string }) => approveFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin", "zones"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
        Pending only
      </label>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
       zones.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No zones.</div> :
       <div className="grid gap-2">
         {zones.map((z: any) => (
           <div key={z.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
             <div>
               <p className="text-sm font-medium">{z.name} <span className="text-xs text-muted-foreground">· {z.sellers?.kitchen_name}</span></p>
               <p className="text-xs text-muted-foreground">{z.pincode} · {z.radius_km} km</p>
             </div>
             <div className="flex items-center gap-2">
               <span className={`rounded-full px-2 py-0.5 text-xs ${z.admin_approved ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                 {z.admin_approved ? "approved" : "pending"}
               </span>
               {!z.admin_approved ? (
                 <>
                   <button onClick={() => approve.mutate({ id: z.id, approve: true })} className="rounded-full bg-success px-3 py-1 text-xs font-medium text-white">Approve</button>
                   <button onClick={() => { const reason = prompt("Reason?") ?? ""; approve.mutate({ id: z.id, approve: false, reason }); }}
                     className="rounded-full border border-border px-3 py-1 text-xs">Reject</button>
                 </>
               ) : (
                 <button onClick={() => approve.mutate({ id: z.id, approve: false, reason: "Revoked by admin" })} className="rounded-full border border-border px-3 py-1 text-xs">Revoke</button>
               )}
             </div>
           </div>
         ))}
       </div>
      }
    </div>
  );
}

function ComplianceTab() {
  const fn = useServerFn(adminDeliveryCompliance);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "compliance"], queryFn: () => fn() });
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Agents awaiting admin" value={data.pending_agents} />
        <Kpi label="Zones awaiting admin" value={data.pending_zones} />
        <Kpi label="Suspended agents" value={data.suspended_agents} />
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium">Low-rated agents (rating &lt; 3 with 5+ deliveries)</p>
        {data.low_rated.length === 0 ? <p className="text-xs text-muted-foreground">None — all good.</p> :
          <ul className="divide-y divide-border text-sm">
            {data.low_rated.map((a: any) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <span>{a.full_name} <span className="text-xs text-muted-foreground">· {a.sellers?.kitchen_name}</span></span>
                <span className="text-xs text-destructive">★ {Number(a.rating_avg).toFixed(2)}</span>
              </li>
            ))}
          </ul>}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function MonitoringTab() {
  const fn = useServerFn(adminLiveAssignments);
  const cancelFn = useServerFn(adminCancelAssignment);
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "live-assignments"], queryFn: () => fn(), refetchInterval: 20_000,
  });
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const ch = supabase.channel("admin-live-assign")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_assignments" },
        () => qc.invalidateQueries({ queryKey: ["admin", "live-assignments"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  const cancel = useMutation({
    mutationFn: (v: { assignment_id: string; reason: string }) => cancelFn({ data: v }),
    onSuccess: () => { toast.success("Cancelled"); qc.invalidateQueries({ queryKey: ["admin", "live-assignments"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const focused = rows.find((r: any) => r.id === selected) ?? rows[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-2 overflow-auto rounded-xl border border-border bg-surface p-2" style={{ maxHeight: 560 }}>
        {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No active deliveries right now.</p>}
        {rows.map((r: any) => (
          <button key={r.id} onClick={() => setSelected(r.id)}
            className={`flex w-full flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm ${focused?.id === r.id ? "border-primary bg-primary/5" : "border-border"}`}>
            <div className="flex w-full items-center justify-between">
              <span className="font-medium">{r.orders?.order_number ?? "Subscription"}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "picked_up" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
                {r.status}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{r.sellers?.kitchen_name} · {r.delivery_agents?.full_name}</span>
            <span className="text-xs text-muted-foreground">
              {r.last_location_at ? `Last ping ${new Date(r.last_location_at).toLocaleTimeString()}` : "No location yet"}
            </span>
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {focused ? (
          <>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="font-medium">{focused.orders?.order_number ?? "Subscription"}</p>
              <p className="text-xs text-muted-foreground">{focused.sellers?.kitchen_name} → {focused.delivery_agents?.full_name}</p>
              <p className="mt-1 text-xs">Phone: {focused.delivery_agents?.phone ?? "—"}</p>
            </div>
            <LiveMap
              agent={focused.current_lat && focused.current_lng
                ? { lat: Number(focused.current_lat), lng: Number(focused.current_lng), label: focused.delivery_agents?.full_name }
                : null}
              height={280}
            />
            <button onClick={() => {
              const reason = prompt("Cancel reason?") || "";
              if (reason) cancel.mutate({ assignment_id: focused.id, reason });
            }} className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-xs font-medium text-white">
              <Ban className="h-3.5 w-3.5" /> Emergency cancel
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select a delivery to view live location.</p>
        )}
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const fn = useServerFn(adminDeliveryAnalytics);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "delivery-analytics"], queryFn: () => fn() });
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const max = Math.max(1, ...data.series.map((s: any) => s.count));
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Assignments (30d)" value={data.total_assignments} />
        <Kpi label="Delivered" value={data.delivered} />
        <Kpi label="Failed" value={data.failed} />
        <Kpi label="Success rate" value={`${data.success_rate}%`} />
        <Kpi label="Avg minutes" value={data.avg_minutes} />
        <Kpi label="Active agents" value={data.total_agents} />
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium">Assignments per day</p>
        <div className="flex items-end gap-1" style={{ height: 140 }}>
          {data.series.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
          {data.series.map((s: any) => (
            <div key={s.day} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-primary/70" style={{ height: `${(s.count / max) * 100}%`, minHeight: 2 }} title={`${s.day}: ${s.count}`} />
              <span className="text-[10px] text-muted-foreground">{s.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Seller</th>
              <th className="p-3 text-right">Agents</th>
              <th className="p-3 text-right">Assigned</th>
              <th className="p-3 text-right">Delivered</th>
              <th className="p-3 text-right">Failed</th>
              <th className="p-3 text-right">Success %</th>
            </tr>
          </thead>
          <tbody>
            {data.sellers.map((s: any) => (
              <tr key={s.seller_id} className="border-t border-border">
                <td className="p-3">{s.kitchen_name}</td>
                <td className="p-3 text-right">{s.agents}</td>
                <td className="p-3 text-right">{s.assigned}</td>
                <td className="p-3 text-right">{s.delivered}</td>
                <td className="p-3 text-right">{s.failed}</td>
                <td className="p-3 text-right">{s.success_rate}%</td>
              </tr>
            ))}
            {data.sellers.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No data.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
