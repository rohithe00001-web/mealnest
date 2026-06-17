import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminListCoupons, adminUpsertCoupon, adminToggleCoupon, adminDeleteCoupon, adminCouponAnalytics,
} from "@/lib/coupons.functions";
import { inr } from "@/lib/format";
import { CouponForm, type CouponDraft, FESTIVALS } from "@/components/CouponForm";

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  component: AdminCouponsPage,
});

function AdminCouponsPage() {
  const listFn = useServerFn(adminListCoupons);
  const upsertFn = useServerFn(adminUpsertCoupon);
  const toggleFn = useServerFn(adminToggleCoupon);
  const delFn = useServerFn(adminDeleteCoupon);
  const analyticsFn = useServerFn(adminCouponAnalytics);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CouponDraft | null>(null);

  const { data: coupons = [], isLoading } = useQuery({ queryKey: ["admin", "coupons"], queryFn: () => listFn() });
  const { data: analytics } = useQuery({ queryKey: ["admin", "coupon-analytics"], queryFn: () => analyticsFn() });

  const save = useMutation({
    mutationFn: (d: CouponDraft) => upsertFn({ data: d as any }),
    onSuccess: () => { toast.success("Coupon saved"); qc.invalidateQueries({ queryKey: ["admin", "coupons"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "coupons"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "coupons"] }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Coupons & Offers</h1>
          <p className="text-sm text-muted-foreground">Manage platform-wide promo codes, festival campaigns and discount rules.</p>
        </div>
        <button onClick={() => setEditing(emptyDraft("platform"))} className="h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">+ New coupon</button>
      </div>

      {analytics && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Total coupons" value={analytics.coupons.length} />
          <Stat label="Redemptions" value={analytics.redemptions.length} />
          <Stat label="Discount given" value={inr(analytics.totalDiscount)} />
          <Stat label="Revenue with coupons" value={inr(analytics.totalRevenue)} />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="p-3 text-left">Code</th><th className="text-left">Type</th><th className="text-left">Value</th><th className="text-left">Scope</th><th className="text-left">Festival</th><th className="text-left">Uses</th><th className="text-left">Status</th><th></th></tr>
            </thead>
            <tbody>
              {coupons.map((c: any) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3 font-mono font-semibold">{c.code}</td>
                  <td>{labelType(c.discount_type)}</td>
                  <td>{valueText(c)}</td>
                  <td className="capitalize">{c.scope}</td>
                  <td>{c.festival_tag ?? "—"}</td>
                  <td>{c.usage_count}{c.usage_limit_total ? `/${c.usage_limit_total}` : ""}</td>
                  <td>
                    <button onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${c.active ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
                      {c.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => setEditing(toDraft(c))} className="text-xs text-primary hover:underline">Edit</button>
                    <button onClick={() => { if (confirm("Delete coupon?")) remove.mutate(c.id); }} className="ml-3 text-xs text-destructive hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No coupons yet. Try one of the festival presets:</td></tr>}
            </tbody>
          </table>
        )}
        {coupons.length === 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border p-4">
            {FESTIVALS.map((f) => (
              <button key={f} onClick={() => setEditing({ ...emptyDraft("platform"), code: `${f.toUpperCase()}25`, festival_tag: f, discount_type: "percent", discount_percent: 25, max_discount: 200, description: `${f} festival offer` })}
                className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary">
                {f} preset
              </button>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <CouponForm draft={editing} onChange={setEditing} onSave={() => save.mutate(editing)} onCancel={() => setEditing(null)} saving={save.isPending} role="admin" />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-semibold">{value}</p></div>;
}
function labelType(t: string) { return ({ flat: "Flat ₹", percent: "% Off", free_delivery: "Free Delivery", partial_delivery: "Delivery Discount" } as any)[t] ?? t; }
function valueText(c: any) {
  if (c.discount_type === "flat") return inr(c.discount_flat ?? 0);
  if (c.discount_type === "percent") return `${c.discount_percent ?? 0}%${c.max_discount ? ` up to ${inr(c.max_discount)}` : ""}`;
  if (c.discount_type === "free_delivery") return "Free delivery";
  if (c.discount_type === "partial_delivery") return `₹${c.discount_flat ?? 0} off delivery`;
  return "—";
}
export function emptyDraft(scope: "platform" | "seller"): CouponDraft {
  return {
    code: "", description: "", scope, seller_id: null,
    discount_type: "flat", discount_flat: 50, discount_percent: 10, max_discount: null,
    min_order: 0, usage_limit_total: null, usage_limit_per_user: 1,
    starts_at: null, expires_at: null, applies_to: "order",
    subscription_plan_types: [], category_ids: [], cuisine_tags: [], geo_pincodes: [],
    festival_tag: null, new_customers_only: false, active: true, metadata: {},
  };
}
function toDraft(c: any): CouponDraft {
  return { ...emptyDraft(c.scope), ...c };
}
