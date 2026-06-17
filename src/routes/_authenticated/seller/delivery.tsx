import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, PauseCircle, Trash2, Plus, MapPin, Calendar, Wallet, TrendingUp, Users } from "lucide-react";
import {
  listSellerAgents, sellerApproveAgent, sellerSuspendAgent, sellerRemoveAgent,
  listSellerApprovedAgents,
  listAgentSchedules, upsertAgentSchedule, deleteAgentSchedule,
  listAgentPayroll, upsertAgentPayroll,
  sellerAgentPerformance,
  listSellerZones, upsertSellerZone, deleteSellerZone,
} from "@/lib/delivery.functions";

export const Route = createFileRoute("/_authenticated/seller/delivery")({
  component: SellerDelivery,
});

const TABS = [
  { id: "agents", label: "Agents", icon: Users },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "payroll", label: "Payroll", icon: Wallet },
  { id: "performance", label: "Performance", icon: TrendingUp },
  { id: "zones", label: "Zones", icon: MapPin },
] as const;
type TabId = typeof TABS[number]["id"];

function SellerDelivery() {
  const [tab, setTab] = useState<TabId>("agents");
  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-semibold">Delivery operations</h2>
        <p className="text-sm text-muted-foreground">Manage your agents, schedules, payroll, performance and zones.</p>
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
      {tab === "schedule" && <ScheduleTab />}
      {tab === "payroll" && <PayrollTab />}
      {tab === "performance" && <PerformanceTab />}
      {tab === "zones" && <ZonesTab />}
    </div>
  );
}

function AgentsTab() {
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

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (agents.length === 0) return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      No agents yet. Share <code>/delivery/register</code> with people who want to deliver for your kitchen.
    </div>
  );
  return (
    <div className="grid gap-3">
      {agents.map((a: any) => (
        <div key={a.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">{a.full_name}</p>
              <p className="text-xs text-muted-foreground">{a.phone} · {a.vehicle_type || "—"} {a.vehicle_number}</p>
              <p className="mt-1 text-xs">Rating {Number(a.rating_avg).toFixed(2)} · {a.delivery_count} deliveries</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge(a.status)}`}>{a.status}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {a.status === "pending_seller" && <>
              <button onClick={() => approve.mutate({ agent_id: a.id, approve: true })} className="inline-flex items-center gap-1 rounded-full bg-success px-3 py-1.5 text-xs font-medium text-white">
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve & forward to admin
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
            <button onClick={() => confirm("Remove this agent?") && remove.mutate({ agent_id: a.id })} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOTS = ["morning", "afternoon", "evening"] as const;

function ScheduleTab() {
  const agentsFn = useServerFn(listSellerApprovedAgents);
  const listFn = useServerFn(listAgentSchedules);
  const upsertFn = useServerFn(upsertAgentSchedule);
  const delFn = useServerFn(deleteAgentSchedule);
  const zonesFn = useServerFn(listSellerZones);
  const qc = useQueryClient();
  const { data: agents = [] } = useQuery({ queryKey: ["seller", "approved-agents"], queryFn: () => agentsFn() });
  const [agentId, setAgentId] = useState<string>("");
  const aid = agentId || agents[0]?.id || "";
  const { data: sched = [] } = useQuery({
    queryKey: ["seller", "schedules", aid],
    queryFn: () => listFn({ data: { agent_id: aid } }),
    enabled: !!aid,
  });
  const { data: zones = [] } = useQuery({ queryKey: ["seller", "zones"], queryFn: () => zonesFn() });
  const upsert = useMutation({
    mutationFn: (v: any) => upsertFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["seller", "schedules"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["seller", "schedules"] }); },
  });

  if (agents.length === 0) return <p className="text-sm text-muted-foreground">Approve at least one agent first.</p>;
  const grid = new Map<string, any>();
  sched.forEach((s: any) => grid.set(`${s.weekday}-${s.slot}`, s));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Agent</label>
        <select value={aid} onChange={(e) => setAgentId(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm">
          {agents.map((a: any) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="p-2 text-left">Slot</th>{WEEKDAYS.map((w) => <th key={w} className="p-2">{w}</th>)}</tr>
          </thead>
          <tbody>
            {SLOTS.map((slot) => (
              <tr key={slot} className="border-t border-border">
                <td className="p-2 font-medium capitalize">{slot}</td>
                {WEEKDAYS.map((_, wd) => {
                  const cell = grid.get(`${wd}-${slot}`);
                  return (
                    <td key={wd} className="p-1.5 text-center">
                      {cell ? (
                        <button onClick={() => del.mutate(cell.id)} title={cell.delivery_zones?.name || "On duty"}
                          className="inline-flex h-7 w-full items-center justify-center rounded-md bg-primary/10 text-xs font-medium text-primary hover:bg-destructive/10 hover:text-destructive">
                          ✓ {cell.delivery_zones?.pincode || ""}
                        </button>
                      ) : (
                        <button onClick={() => {
                          const zone_id = zones[0]?.id ?? null;
                          upsert.mutate({ agent_id: aid, weekday: wd, slot, active: true, zone_id });
                        }} className="inline-flex h-7 w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground hover:bg-muted">
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Click ✓ to remove a slot. New slots use your first zone by default.</p>
    </div>
  );
}

function PayrollTab() {
  const listFn = useServerFn(listAgentPayroll);
  const agentsFn = useServerFn(listSellerApprovedAgents);
  const upsertFn = useServerFn(upsertAgentPayroll);
  const qc = useQueryClient();
  const monthDefault = new Date().toISOString().slice(0, 7) + "-01";
  const [month, setMonth] = useState(monthDefault);
  const { data: rows = [] } = useQuery({ queryKey: ["seller", "payroll", month], queryFn: () => listFn({ data: { month } }) });
  const { data: agents = [] } = useQuery({ queryKey: ["seller", "approved-agents"], queryFn: () => agentsFn() });
  const upsert = useMutation({
    mutationFn: (v: any) => upsertFn({ data: v }),
    onSuccess: (r: any) => { toast.success(`Computed ₹${r.computed} (${r.delivered} deliveries)`); qc.invalidateQueries({ queryKey: ["seller", "payroll"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const byAgent = new Map<string, any>();
  rows.forEach((r: any) => byAgent.set(r.agent_id, r));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Month</label>
        <input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(e.target.value + "-01")}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm" />
      </div>
      <div className="grid gap-3">
        {agents.map((a: any) => {
          const r = byAgent.get(a.id);
          return <PayrollRow key={a.id} agent={a} row={r} month={month} onSave={(v: any) => upsert.mutate(v)} />;
        })}
        {agents.length === 0 && <p className="text-sm text-muted-foreground">No approved agents.</p>}
      </div>
    </div>
  );
}

function PayrollRow({ agent, row, month, onSave }: any) {
  const [base, setBase] = useState(row?.salary_base ?? 0);
  const [rate, setRate] = useState(row?.per_order_rate ?? 0);
  const [status, setStatus] = useState(row?.status ?? "pending");
  const [paid, setPaid] = useState(row?.paid_amount ?? 0);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]">
          <p className="font-medium">{agent.full_name}</p>
          <p className="text-xs text-muted-foreground">{agent.phone}</p>
        </div>
        <Field label="Base salary"><input type="number" value={base} onChange={(e) => setBase(Number(e.target.value))} className="input" /></Field>
        <Field label="Per order"><input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="input" /></Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="pending">pending</option><option value="approved">approved</option><option value="paid">paid</option>
          </select>
        </Field>
        <Field label="Paid amt"><input type="number" value={paid} onChange={(e) => setPaid(Number(e.target.value))} className="input" /></Field>
        {row && <div className="text-xs text-muted-foreground">
          <p>Computed: <span className="font-semibold text-foreground">₹{Number(row.computed_amount).toFixed(0)}</span></p>
          <p>{row.incentive_rules?.delivered_orders ?? 0} delivered</p>
        </div>}
        <button onClick={() => onSave({ agent_id: agent.id, month, salary_base: base, per_order_rate: rate, status, paid_amount: paid })}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">Compute & save</button>
      </div>
    </div>
  );
}

function Field({ label, children }: any) {
  return <label className="flex flex-col gap-1 text-xs"><span className="text-muted-foreground">{label}</span>{children}</label>;
}

function PerformanceTab() {
  const fn = useServerFn(sellerAgentPerformance);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["seller", "perf"], queryFn: () => fn() });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No agents yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-3 text-left">Agent</th>
            <th className="p-3 text-right">Rating</th>
            <th className="p-3 text-right">Total</th>
            <th className="p-3 text-right">30d assigned</th>
            <th className="p-3 text-right">30d delivered</th>
            <th className="p-3 text-right">30d failed</th>
            <th className="p-3 text-right">Success %</th>
            <th className="p-3 text-right">Avg min</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id} className="border-t border-border">
              <td className="p-3">{r.full_name}<span className="ml-2 text-xs text-muted-foreground">{r.status}</span></td>
              <td className="p-3 text-right">{Number(r.rating_avg).toFixed(2)}</td>
              <td className="p-3 text-right">{r.delivery_count}</td>
              <td className="p-3 text-right">{r.last30_assigned}</td>
              <td className="p-3 text-right">{r.last30_delivered}</td>
              <td className="p-3 text-right">{r.last30_failed}</td>
              <td className="p-3 text-right">{r.success_rate}%</td>
              <td className="p-3 text-right">{r.avg_minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ZonesTab() {
  const listFn = useServerFn(listSellerZones);
  const upsertFn = useServerFn(upsertSellerZone);
  const delFn = useServerFn(deleteSellerZone);
  const qc = useQueryClient();
  const { data: zones = [] } = useQuery({ queryKey: ["seller", "zones"], queryFn: () => listFn() });
  const [form, setForm] = useState({ name: "", pincode: "", radius_km: 5 });
  const upsert = useMutation({
    mutationFn: (v: any) => upsertFn({ data: v }),
    onSuccess: () => { toast.success("Zone saved — pending admin approval"); setForm({ name: "", pincode: "", radius_km: 5 }); qc.invalidateQueries({ queryKey: ["seller", "zones"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seller", "zones"] }),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium">Request a new zone</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="HSR Layout" /></Field>
          <Field label="Pincode"><input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className="input" placeholder="560102" /></Field>
          <Field label="Radius (km)"><input type="number" step="0.5" value={form.radius_km} onChange={(e) => setForm({ ...form, radius_km: Number(e.target.value) })} className="input" /></Field>
          <button onClick={() => upsert.mutate(form)} disabled={!form.name || !form.pincode}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">Submit</button>
        </div>
      </div>
      <div className="grid gap-2">
        {zones.map((z: any) => (
          <div key={z.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
            <div>
              <p className="text-sm font-medium">{z.name} <span className="text-xs text-muted-foreground">· {z.pincode} · {z.radius_km} km</span></p>
              {!z.admin_approved && z.rejected_reason && <p className="text-xs text-destructive">Rejected: {z.rejected_reason}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${z.admin_approved ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                {z.admin_approved ? "approved" : "pending admin"}
              </span>
              <button onClick={() => confirm("Delete zone?") && del.mutate(z.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {zones.length === 0 && <p className="text-sm text-muted-foreground">No zones yet.</p>}
      </div>
      <style>{`.input{border:1px solid hsl(var(--border));background:hsl(var(--surface));border-radius:0.5rem;padding:0.375rem 0.625rem;font-size:0.875rem;width:8rem}`}</style>
    </div>
  );
}

function badge(s: string) {
  if (s === "approved") return "bg-success/10 text-success";
  if (s === "rejected") return "bg-destructive/10 text-destructive";
  if (s === "suspended") return "bg-muted text-muted-foreground";
  return "bg-warning/10 text-warning";
}
