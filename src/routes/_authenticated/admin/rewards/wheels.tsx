import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit } from "lucide-react";
import {
  listWheels, upsertWheel, toggleWheel, deleteWheel,
  listSegments, upsertSegment, deleteSegment,
} from "@/lib/rewards-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/rewards/wheels")({
  component: WheelsAdmin,
});

const REWARD_TYPES = [
  "cash_off", "percent_off", "free_delivery", "coins", "sub_discount", "free_food", "jackpot_coupon", "better_luck",
];

const emptyWheel: any = {
  name: "", description: "", scope: "global", active: false,
  spins_per_day: 1, spins_per_week: 7, spins_per_month: 30,
  require_login: true, require_order: false, require_subscription: false,
  require_referral: false, min_purchase_amount: 0,
};

const emptySeg: any = {
  label: "", reward_type: "coins", reward_value: 50,
  coupon_min_order: 0, coupon_expires_days: 14, coupon_stackable: false,
  applies_to: "order", probability_weight: 0, active: true, sort_order: 0, color: "#f59e0b",
};

function WheelsAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listWheels);
  const upsert = useServerFn(upsertWheel);
  const toggle = useServerFn(toggleWheel);
  const del = useServerFn(deleteWheel);
  const { data, isLoading } = useQuery({ queryKey: ["wheels"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);
  const [openWheel, setOpenWheel] = useState<string | null>(null);

  const saveM = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["wheels"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggleM = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wheels"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["wheels"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Mystery Wheels</h3>
        <Button onClick={() => setEditing({ ...emptyWheel })}><Plus className="h-4 w-4 mr-1" /> New wheel</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
        <div className="space-y-3">
          {(data ?? []).map((w: any) => (
            <div key={w.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{w.name} <span className="text-xs text-muted-foreground">({w.scope})</span></div>
                  <div className="text-xs text-muted-foreground">{w.description}</div>
                  <div className="text-xs mt-1 text-muted-foreground">
                    Limits: {w.spins_per_day}/day · {w.spins_per_week}/wk · {w.spins_per_month}/mo
                  </div>
                </div>
                <Switch checked={w.active} onCheckedChange={(v) => toggleM.mutate({ id: w.id, active: v })} />
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setOpenWheel(w.id)}>Manage segments</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(w)}><Edit className="h-3 w-3 mr-1" /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete wheel and its segments?")) delM.mutate(w.id); }}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit wheel" : "New wheel"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2"><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Description</Label><Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div>
                <Label>Scope</Label>
                <Select value={editing.scope} onValueChange={(v) => setEditing({ ...editing, scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="seller">Seller</SelectItem>
                    <SelectItem value="campaign">Campaign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Min purchase (₹)</Label><Input type="number" value={editing.min_purchase_amount} onChange={(e) => setEditing({ ...editing, min_purchase_amount: Number(e.target.value) })} /></div>
              <div><Label>Spins / day</Label><Input type="number" value={editing.spins_per_day} onChange={(e) => setEditing({ ...editing, spins_per_day: Number(e.target.value) })} /></div>
              <div><Label>Spins / week</Label><Input type="number" value={editing.spins_per_week} onChange={(e) => setEditing({ ...editing, spins_per_week: Number(e.target.value) })} /></div>
              <div><Label>Spins / month</Label><Input type="number" value={editing.spins_per_month} onChange={(e) => setEditing({ ...editing, spins_per_month: Number(e.target.value) })} /></div>
              <div><Label>Starts at</Label><Input type="datetime-local" value={editing.starts_at ?? ""} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value || null })} /></div>
              <div><Label>Ends at</Label><Input type="datetime-local" value={editing.ends_at ?? ""} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value || null })} /></div>
              <div className="md:col-span-2">
                <div className="text-sm font-semibold mb-2">Eligibility</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[["require_login","Login required"],["require_order","Order required"],["require_subscription","Subscription required"],["require_referral","Completed referral"]].map(([k,l]) => (
                    <label key={k} className="flex items-center gap-2">
                      <Switch checked={!!editing[k]} onCheckedChange={(v) => setEditing({ ...editing, [k]: v })} />
                      <span>{l}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={() => saveM.mutate(editing)} disabled={saveM.isPending}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SegmentsDialog wheelId={openWheel} onClose={() => setOpenWheel(null)} />
    </div>
  );
}

function SegmentsDialog({ wheelId, onClose }: { wheelId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const list = useServerFn(listSegments);
  const upsert = useServerFn(upsertSegment);
  const del = useServerFn(deleteSegment);
  const { data, isLoading } = useQuery({
    queryKey: ["segments", wheelId],
    queryFn: () => list({ data: { wheel_id: wheelId! } }),
    enabled: !!wheelId,
  });
  const [edit, setEdit] = useState<any | null>(null);

  const saveM = useMutation({
    mutationFn: (v: any) => upsert({ data: { ...v, wheel_id: wheelId } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["segments", wheelId] }); setEdit(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["segments", wheelId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const total = data?.probabilityTotal ?? 0;
  const valid = data?.valid;

  return (
    <Dialog open={!!wheelId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Wheel segments</DialogTitle></DialogHeader>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm">
            Total active probability: <span className={valid ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>{total}%</span>
            {!valid && <span className="text-xs text-rose-600 ml-2">Must equal 100 to activate</span>}
          </div>
          <Button size="sm" onClick={() => setEdit({ ...emptySeg })}><Plus className="h-3 w-3 mr-1" /> Add</Button>
        </div>
        <div className="h-2 rounded bg-muted overflow-hidden mb-3">
          <div className={`h-full ${valid ? "bg-emerald-500" : total > 100 ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, total)}%` }} />
        </div>
        {isLoading ? <p>Loading…</p> : (
          <div className="space-y-2">
            {(data?.segments ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                <div className="w-4 h-4 rounded" style={{ background: s.color }} />
                <div className="flex-1">
                  <div className="font-medium text-sm">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.reward_type} · value {s.reward_value} · weight {s.probability_weight}%</div>
                </div>
                <Switch checked={s.active} onCheckedChange={(v) => saveM.mutate({ ...s, active: v })} />
                <Button size="sm" variant="ghost" onClick={() => setEdit(s)}><Edit className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete segment?")) delM.mutate(s.id); }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        )}

        <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{edit?.id ? "Edit segment" : "New segment"}</DialogTitle></DialogHeader>
            {edit && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Label</Label><Input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></div>
                <div>
                  <Label>Reward type</Label>
                  <Select value={edit.reward_type} onValueChange={(v) => setEdit({ ...edit, reward_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{REWARD_TYPES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Value</Label><Input type="number" value={edit.reward_value} onChange={(e) => setEdit({ ...edit, reward_value: Number(e.target.value) })} /></div>
                <div><Label>Probability %</Label><Input type="number" step="0.1" value={edit.probability_weight} onChange={(e) => setEdit({ ...edit, probability_weight: Number(e.target.value) })} /></div>
                <div><Label>Color</Label><Input type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} /></div>
                <div><Label>Min order (₹)</Label><Input type="number" value={edit.coupon_min_order} onChange={(e) => setEdit({ ...edit, coupon_min_order: Number(e.target.value) })} /></div>
                <div><Label>Expires (days)</Label><Input type="number" value={edit.coupon_expires_days} onChange={(e) => setEdit({ ...edit, coupon_expires_days: Number(e.target.value) })} /></div>
                <div>
                  <Label>Applies to</Label>
                  <Select value={edit.applies_to} onValueChange={(v) => setEdit({ ...edit, applies_to: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="order">Order</SelectItem>
                      <SelectItem value="subscription">Subscription</SelectItem>
                      <SelectItem value="any">Any</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Sort</Label><Input type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></div>
                <label className="col-span-2 flex items-center gap-2 text-sm"><Switch checked={!!edit.coupon_stackable} onCheckedChange={(v) => setEdit({ ...edit, coupon_stackable: v })} /> Stackable</label>
                <label className="col-span-2 flex items-center gap-2 text-sm"><Switch checked={!!edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /> Active</label>
                <div className="col-span-2 flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
                  <Button onClick={() => saveM.mutate(edit)} disabled={saveM.isPending}>Save</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
