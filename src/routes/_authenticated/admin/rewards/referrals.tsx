import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Power } from "lucide-react";
import {
  listReferralCampaigns,
  upsertReferralCampaign,
  toggleReferralCampaign,
  deleteReferralCampaign,
} from "@/lib/rewards-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/rewards/referrals")({
  component: ReferralsAdmin,
});

const REWARD_TYPES = [
  { value: "cash", label: "Cash / wallet" },
  { value: "coupon", label: "Coupon" },
  { value: "coins", label: "MealNest coins" },
  { value: "free_delivery", label: "Free delivery" },
  { value: "sub_discount", label: "Subscription discount" },
];

const TRIGGERS = [
  { value: "first_order", label: "After first order" },
  { value: "payment", label: "After successful payment" },
  { value: "subscription", label: "After subscription purchase" },
];

const emptyCampaign: any = {
  name: "",
  description: "",
  active: true,
  referrer_reward_type: "coins",
  referrer_reward_value: 200,
  referred_reward_type: "coins",
  referred_reward_value: 100,
  min_order_amount: 0,
  max_uses_per_referrer: 50,
  reward_trigger: "first_order",
  expiry_days: 30,
  fraud_device_check: true,
  fraud_duplicate_account: true,
  fraud_multi_referral: true,
  fraud_ip_validation: true,
  fraud_self_block: true,
};

function ReferralsAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listReferralCampaigns);
  const upsert = useServerFn(upsertReferralCampaign);
  const toggle = useServerFn(toggleReferralCampaign);
  const del = useServerFn(deleteReferralCampaign);
  const { data, isLoading } = useQuery({ queryKey: ["ref-campaigns"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);

  const saveM = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["ref-campaigns"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggleM = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ref-campaigns"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["ref-campaigns"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Referral Campaigns</h3>
        <Button onClick={() => setEditing({ ...emptyCampaign })}><Plus className="h-4 w-4 mr-1" /> New campaign</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data ?? []).map((c: any) => (
            <div key={c.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.description}</div>
                </div>
                <Switch checked={c.active} onCheckedChange={(v) => toggleM.mutate({ id: c.id, active: v })} />
              </div>
              <div className="mt-3 text-sm grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Referrer:</span> {c.referrer_reward_value} {c.referrer_reward_type}</div>
                <div><span className="text-muted-foreground">New user:</span> {c.referred_reward_value} {c.referred_reward_type}</div>
                <div><span className="text-muted-foreground">Trigger:</span> {c.reward_trigger}</div>
                <div><span className="text-muted-foreground">Min order:</span> ₹{c.min_order_amount}</div>
                <div><span className="text-muted-foreground">Max uses:</span> {c.max_uses_per_referrer}</div>
                <div><span className="text-muted-foreground">Expiry:</span> {c.expiry_days}d</div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(c)}><Edit className="h-3 w-3 mr-1" /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this campaign?")) delM.mutate(c.id); }}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit campaign" : "New campaign"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <Label>Referrer reward type</Label>
                <Select value={editing.referrer_reward_type} onValueChange={(v) => setEditing({ ...editing, referrer_reward_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REWARD_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Referrer reward value</Label>
                <Input type="number" value={editing.referrer_reward_value} onChange={(e) => setEditing({ ...editing, referrer_reward_value: Number(e.target.value) })} />
              </div>
              <div>
                <Label>New user reward type</Label>
                <Select value={editing.referred_reward_type} onValueChange={(v) => setEditing({ ...editing, referred_reward_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REWARD_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>New user reward value</Label>
                <Input type="number" value={editing.referred_reward_value} onChange={(e) => setEditing({ ...editing, referred_reward_value: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Reward trigger</Label>
                <Select value={editing.reward_trigger} onValueChange={(v) => setEditing({ ...editing, reward_trigger: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TRIGGERS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Min order (₹)</Label>
                <Input type="number" value={editing.min_order_amount} onChange={(e) => setEditing({ ...editing, min_order_amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Max uses per referrer</Label>
                <Input type="number" value={editing.max_uses_per_referrer} onChange={(e) => setEditing({ ...editing, max_uses_per_referrer: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Expiry (days)</Label>
                <Input type="number" value={editing.expiry_days} onChange={(e) => setEditing({ ...editing, expiry_days: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Starts at</Label>
                <Input type="datetime-local" value={editing.starts_at ?? ""} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value || null })} />
              </div>
              <div>
                <Label>Ends at</Label>
                <Input type="datetime-local" value={editing.ends_at ?? ""} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value || null })} />
              </div>
              <div className="md:col-span-2 mt-2">
                <div className="text-sm font-semibold mb-2">Fraud protection</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {[
                    ["fraud_self_block", "Self-referral block"],
                    ["fraud_device_check", "Device detection"],
                    ["fraud_duplicate_account", "Duplicate account"],
                    ["fraud_multi_referral", "Max-uses cap"],
                    ["fraud_ip_validation", "IP validation"],
                  ].map(([k, l]) => (
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
    </div>
  );
}
