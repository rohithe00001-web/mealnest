import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, Award, TrendingUp, Plus, Power } from "lucide-react";
import {
  adminPromoAnalytics,
  adminListSponsorships,
  adminGrantSponsorship,
  adminToggleSponsorship,
} from "@/lib/gamification.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/promotions")({
  component: PromoAnalyticsPage,
});

function PromoAnalyticsPage() {
  const qc = useQueryClient();
  const analyticsFn = useServerFn(adminPromoAnalytics);
  const listSponsors = useServerFn(adminListSponsorships);
  const grant = useServerFn(adminGrantSponsorship);
  const toggle = useServerFn(adminToggleSponsorship);

  const { data: a } = useQuery({ queryKey: ["admin", "promo-analytics"], queryFn: () => analyticsFn() });
  const { data: sponsors } = useQuery({ queryKey: ["admin", "sponsorships"], queryFn: () => listSponsors() });

  const [sellerId, setSellerId] = useState("");
  const [kind, setKind] = useState<"new_boost" | "featured" | "top_rated">("featured");
  const [endsAt, setEndsAt] = useState("");

  const grantM = useMutation({
    mutationFn: () => grant({ data: { seller_id: sellerId, kind, ends_at: endsAt || null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "sponsorships"] });
      setSellerId(""); setEndsAt("");
      toast.success("Sponsorship granted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: sellersList } = useQuery({
    queryKey: ["admin", "sellers-min"],
    queryFn: async () => {
      const { data } = await supabase.from("sellers").select("id, kitchen_name").order("kitchen_name");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold">Promotions analytics</h2>
        <p className="text-sm text-muted-foreground">Performance across coupons, campaigns, and gamification.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Coupon redemptions" value={a?.redemptionsCount ?? 0} />
        <Stat label="Discount given" value={`₹${Math.round(a?.totalDiscount ?? 0).toLocaleString()}`} />
        <Stat label="Revenue from offers" value={`₹${Math.round(a?.totalRevenue ?? 0).toLocaleString()}`} />
        <Stat label="Active campaigns" value={(a?.campaigns ?? []).filter((c: any) => c.active).length} />
        <Stat label="Total spins" value={a?.spinsTotal ?? 0} />
        <Stat label="Spins today" value={a?.spinsToday ?? 0} />
        <Stat label="Mystery rewards" value={a?.mysteryTotal ?? 0} />
        <Stat label="Mystery claim rate" value={`${a?.mysteryClaimRate ?? 0}%`} />
      </div>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Campaign performance</h3>
        </div>
        <div className="rounded-xl border border-border bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr><th className="text-left p-2">Name</th><th className="text-left p-2">Type</th><th className="text-left p-2">Used</th><th className="text-left p-2">Status</th></tr>
            </thead>
            <tbody>
              {(a?.campaigns ?? []).map((c: any) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-2 font-medium">{c.name}</td>
                  <td className="p-2 capitalize">{c.type.replace("_", " ")}</td>
                  <td className="p-2">{c.used_count}</td>
                  <td className="p-2">{c.active ? "Active" : "Paused"}</td>
                </tr>
              ))}
              {(a?.campaigns ?? []).length === 0 && <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">No campaigns yet</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Award className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Seller sponsorships</h3>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <div>
              <Label>Seller</Label>
              <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
                <option value="">Pick a kitchen…</option>
                {(sellersList ?? []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.kitchen_name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Boost</Label>
              <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={kind} onChange={(e) => setKind(e.target.value as any)}>
                <option value="new_boost">New kitchen boost</option>
                <option value="featured">Featured</option>
                <option value="top_rated">Top rated</option>
              </select>
            </div>
            <div>
              <Label>Ends at</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value ? new Date(e.target.value).toISOString() : "")} />
            </div>
            <Button disabled={!sellerId || grantM.isPending} onClick={() => grantM.mutate()}>
              <Plus className="h-4 w-4 mr-1" />Grant
            </Button>
          </div>

          <ul className="mt-4 divide-y divide-border">
            {(sponsors ?? []).map((s: any) => (
              <li key={s.id} className="py-2 flex items-center gap-3 text-sm">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <div className="flex-1">
                  <div className="font-medium">{s.sellers?.kitchen_name ?? s.seller_id}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {s.kind.replace("_", " ")}
                    {s.ends_at && ` • until ${new Date(s.ends_at).toLocaleDateString()}`}
                  </div>
                </div>
                <Button variant="outline" size="sm"
                  onClick={() => toggle({ data: { id: s.id, active: !s.active } })
                    .then(() => qc.invalidateQueries({ queryKey: ["admin", "sponsorships"] }))}>
                  <Power className="h-3 w-3 mr-1" />{s.active ? "Active" : "Paused"}
                </Button>
              </li>
            ))}
            {(sponsors ?? []).length === 0 && <li className="py-3 text-center text-xs text-muted-foreground">No sponsorships yet</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-display font-semibold">{value}</div>
    </div>
  );
}