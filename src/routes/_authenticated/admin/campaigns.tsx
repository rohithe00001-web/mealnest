import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Power, Trash2, Star } from "lucide-react";
import {
  adminListCampaigns, adminUpsertCampaign, adminToggleCampaign, adminDeleteCampaign,
} from "@/lib/campaigns.functions";
import { CampaignForm, type CampaignFormValues } from "@/components/CampaignForm";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/campaigns")({
  component: AdminCampaignsPage,
});

function AdminCampaignsPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListCampaigns);
  const upsert = useServerFn(adminUpsertCampaign);
  const toggle = useServerFn(adminToggleCampaign);
  const del = useServerFn(adminDeleteCampaign);

  const { data, isLoading } = useQuery({ queryKey: ["admin", "campaigns"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const upsertM = useMutation({
    mutationFn: (v: CampaignFormValues) => upsert({ data: v as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "campaigns"] });
      setOpen(false); setEditing(null);
      toast.success("Campaign saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Promotional campaigns</h2>
          <p className="text-sm text-muted-foreground">Festivals, flash sales, family plans, corporate offers.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} campaign</DialogTitle></DialogHeader>
            <CampaignForm
              initial={editing ?? undefined}
              showFeatured
              submitting={upsertM.isPending}
              onSubmit={(v) => upsertM.mutate(v)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No campaigns yet. Create your first one.
        </div>
      ) : (
        <div className="grid gap-3">
          {data.map((c: any) => (
            <div key={c.id} className="rounded-xl border border-border bg-surface p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.name}</span>
                  {c.featured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{c.type.replace("_", " ")}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {c.discount_type === "percent" ? `${c.discount_value}% off` : c.discount_type === "flat" ? `₹${c.discount_value} off` : c.discount_type}
                  {" • "}{c.used_count} used
                  {c.ends_at && ` • ends ${new Date(c.ends_at).toLocaleDateString()}`}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setEditing(c); setOpen(true); }}>Edit</Button>
              <Button variant="outline" size="sm"
                onClick={() => toggle({ data: { id: c.id, active: !c.active } }).then(() => qc.invalidateQueries({ queryKey: ["admin", "campaigns"] }))}>
                <Power className="mr-1 h-3.5 w-3.5" />{c.active ? "Active" : "Paused"}
              </Button>
              <Button variant="ghost" size="sm"
                onClick={() => {
                  if (!confirm(`Delete "${c.name}"?`)) return;
                  del({ data: { id: c.id } }).then(() => qc.invalidateQueries({ queryKey: ["admin", "campaigns"] }));
                }}>
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}