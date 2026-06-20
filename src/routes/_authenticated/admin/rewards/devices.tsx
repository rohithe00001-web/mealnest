import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Ban, Check, X, Shield, ShieldOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  adminListDevices, adminDeviceDetail, adminBlacklistDevice,
  adminRemoveDeviceRestriction, adminListOverrideRequests, adminDecideOverride,
} from "@/lib/devices.functions";

export const Route = createFileRoute("/_authenticated/admin/rewards/devices")({
  component: AdminDevices,
});

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-600",
  medium: "bg-amber-500/10 text-amber-600",
  high: "bg-orange-500/10 text-orange-600",
  critical: "bg-red-500/10 text-red-600",
};

function AdminDevices() {
  const qc = useQueryClient();
  const list = useServerFn(adminListDevices);
  const detail = useServerFn(adminDeviceDetail);
  const black = useServerFn(adminBlacklistDevice);
  const removeR = useServerFn(adminRemoveDeviceRestriction);
  const overrides = useServerFn(adminListOverrideRequests);
  const decide = useServerFn(adminDecideOverride);

  const [risk, setRisk] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: devices } = useQuery({ queryKey: ["adm-devices", risk, search], queryFn: () => list({ data: { risk, search } }) });
  const { data: ov } = useQuery({ queryKey: ["adm-overrides"], queryFn: () => overrides() });
  const { data: det } = useQuery({
    queryKey: ["adm-device", selectedId],
    queryFn: () => detail({ data: { id: selectedId! } }),
    enabled: !!selectedId,
  });

  const blackM = useMutation({
    mutationFn: (v: { id: string; blacklisted: boolean }) => black({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["adm-devices"] }); qc.invalidateQueries({ queryKey: ["adm-device"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const removeM = useMutation({
    mutationFn: (id: string) => removeR({ data: { id } }),
    onSuccess: () => { toast.success("Restrictions removed"); qc.invalidateQueries({ queryKey: ["adm-device"] }); },
  });
  const decideM = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => decide({ data: v }),
    onSuccess: () => { toast.success("Decision saved"); qc.invalidateQueries({ queryKey: ["adm-overrides"] }); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Override requests</h3>
        <div className="mt-2 rounded-2xl border border-border bg-surface divide-y divide-border">
          {(ov ?? []).filter((r: any) => r.status === "pending").length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No pending requests.</p>
          )}
          {(ov ?? []).filter((r: any) => r.status === "pending").map((r: any) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <div>
                <div className="font-medium">{r.requesting_email}</div>
                <div className="text-xs text-muted-foreground">{r.reason}</div>
                <div className="text-xs text-muted-foreground">FP: {r.fingerprint.slice(0, 16)}…</div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" onClick={() => decideM.mutate({ id: r.id, approve: true })}><Check className="h-3 w-3 mr-1"/>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => decideM.mutate({ id: r.id, approve: false })}><X className="h-3 w-3 mr-1"/>Reject</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-lg font-semibold">Devices</h3>
          <div className="flex gap-2">
            <Select value={risk} onValueChange={setRisk}>
              <SelectTrigger className="w-36"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All risk</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Search fingerprint…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56"/>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2 text-left">Fingerprint</th><th className="px-3 py-2 text-left">Platform</th><th className="px-3 py-2 text-left">Risk</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Last seen</th><th className="px-3 py-2"/></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(devices ?? []).map((d: any) => (
                <tr key={d.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 font-mono text-xs">{d.fingerprint.slice(0, 16)}…</td>
                  <td className="px-3 py-2">{d.platform ?? "—"}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${RISK_COLORS[d.risk_level] ?? ""}`}>{d.risk_level} ({d.risk_score})</span></td>
                  <td className="px-3 py-2">{d.blacklisted ? <span className="text-red-600">Blacklisted</span> : d.status}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(d.last_seen_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelectedId(d.id)}>Inspect</Button>
                  </td>
                </tr>
              ))}
              {(devices ?? []).length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No devices found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Device details</DialogTitle></DialogHeader>
          {det?.device && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-border p-3">
                <div className="font-mono text-xs break-all">{det.device.fingerprint}</div>
                <div className="mt-1 text-xs text-muted-foreground">{det.device.user_agent}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${RISK_COLORS[det.device.risk_level] ?? ""}`}>Risk: {det.device.risk_level} ({det.device.risk_score})</span>
                  {det.device.blacklisted && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-600">Blacklisted</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant={det.device.blacklisted ? "outline" : "destructive"}
                    onClick={() => blackM.mutate({ id: det.device.id, blacklisted: !det.device.blacklisted })}>
                    {det.device.blacklisted ? <><ShieldOff className="mr-1 h-3 w-3"/>Unblacklist</> : <><Ban className="mr-1 h-3 w-3"/>Blacklist</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => removeM.mutate(det.device.id)}>
                    <Shield className="mr-1 h-3 w-3"/>Remove restrictions
                  </Button>
                </div>
              </div>

              <div>
                <div className="font-semibold mb-1">Linked accounts ({det.accounts.length})</div>
                <div className="space-y-1">
                  {det.accounts.map((a: any) => (
                    <div key={a.id} className="rounded-lg border border-border p-2 text-xs">
                      <div>User: {a.user_id}</div>
                      <div className="text-muted-foreground">Role: {a.role} · {a.is_primary ? "primary" : "secondary"} · {a.approval_status}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-semibold mb-1">Fraud events ({det.fraud.length})</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {det.fraud.map((f: any) => (
                    <div key={f.id} className="rounded-lg border border-border p-2 text-xs">
                      <div className="font-medium">{f.kind}</div>
                      <div className="text-muted-foreground">{new Date(f.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-semibold mb-1">Audit log</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {det.audit.map((a: any) => (
                    <div key={a.id} className="rounded-lg border border-border p-2 text-xs">
                      <div className="font-medium">{a.action}</div>
                      <div className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
