import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Power } from "lucide-react";
import {
  sellerListCampaigns, sellerUpsertCampaign, sellerToggleCampaign,
} from "@/lib/campaigns.functions";
import { CampaignForm, type CampaignFormValues } from "@/components/CampaignForm";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seller/campaigns")({
  component: SellerCampaignsPage,
});

function SellerCampaignsPage() {
  const qc = useQueryClient();
  const list = useServerFn(sellerListCampaigns);
  const upsert = useServerFn(sellerUpsertCampaign);
  const toggle = useServerFn(sellerToggleCampaign);
  const { data, isLoading } = useQuery({ queryKey: ["seller", "campaigns"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const upsertM = useMutation({
    mutationFn: (v: CampaignFormValues) => upsert({ data: v as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seller", "campaigns"] });
      setOpen(false); setEditing(null);
      toast.success("Campaign saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Your campaigns</h2>
          <p className="text-sm text-muted-foreground">Run happy hour, flash sales, combo deals for your kitchen.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} campaign</DialogTitle></DialogHeader>
            <CampaignForm
              initial={editing ?? undefined}
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
          No campaigns yet. Set up a happy hour or flash sale to boost orders.
        </div>
      ) : (
        <div className="grid gap-3">
          {data.map((c: any) => (
            <div key={c.id} className="rounded-xl border border-border bg-surface p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.name}</span>
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
                onClick={() => toggle({ data: { id: c.id, active: !c.active } }).then(() => qc.invalidateQueries({ queryKey: ["seller", "campaigns"] }))}>
                <Power className="mr-1 h-3.5 w-3.5" />{c.active ? "Active" : "Paused"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}