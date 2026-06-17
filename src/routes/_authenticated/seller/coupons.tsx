import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { sellerListCoupons, sellerUpsertCoupon, sellerToggleCoupon, sellerCouponAnalytics } from "@/lib/coupons.functions";
import { inr } from "@/lib/format";
import { CouponForm, type CouponDraft } from "@/components/CouponForm";
import { emptyDraft } from "@/routes/_authenticated/admin/coupons";

export const Route = createFileRoute("/_authenticated/seller/coupons")({
  component: SellerCouponsPage,
});

const PRESETS: Array<{ code: string; type: "flat" | "percent" | "free_delivery"; val: number; desc: string; newCustomersOnly?: boolean; applies_to?: "order" | "subscription" }> = [
  { code: "MOMSPECIAL20", type: "percent", val: 20, desc: "20% off any order" },
  { code: "FIRSTORDER10", type: "percent", val: 10, desc: "First-time customer offer", newCustomersOnly: true },
  { code: "FREEDEL", type: "free_delivery", val: 0, desc: "Free delivery on us" },
  { code: "WEEKLY15", type: "percent", val: 15, desc: "15% off weekly plans", applies_to: "subscription" },
];

function SellerCouponsPage() {
  const listFn = useServerFn(sellerListCoupons);
  const upsertFn = useServerFn(sellerUpsertCoupon);
  const toggleFn = useServerFn(sellerToggleCoupon);
  const analyticsFn = useServerFn(sellerCouponAnalytics);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CouponDraft | null>(null);

  const { data: coupons = [] } = useQuery({ queryKey: ["seller", "coupons"], queryFn: () => listFn() });
  const { data: analytics } = useQuery({ queryKey: ["seller", "coupon-analytics"], queryFn: () => analyticsFn() });

  const save = useMutation({
    mutationFn: (d: CouponDraft) => upsertFn({ data: d as any }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["seller", "coupons"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seller", "coupons"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Your Coupons</h1>
          <p className="text-sm text-muted-foreground">Promote your kitchen with custom offers.</p>
        </div>
        <button onClick={() => setEditing(emptyDraft("seller"))} className="h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">+ New offer</button>
      </div>

      {analytics && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Active offers" value={analytics.coupons.filter((c: any) => true).length} />
          <Stat label="Total redemptions" value={analytics.redemptions.length} />
          <Stat label="Discount given" value={inr(analytics.totalDiscount)} />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap gap-2 border-b border-border p-4">
          <p className="text-xs uppercase text-muted-foreground w-full">Quick presets</p>
          {PRESETS.map((p) => (
            <button key={p.code} onClick={() => setEditing({
              ...emptyDraft("seller"),
              code: p.code, description: p.desc, discount_type: p.type,
              discount_percent: p.type === "percent" ? p.val : 0,
              discount_flat: p.type === "flat" ? p.val : 0,
              new_customers_only: (p as any).newCustomersOnly ?? false,
              applies_to: (p as any).applies_to ?? "order",
            })}
              className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary">{p.code}</button>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr><th className="p-3 text-left">Code</th><th className="text-left">Type</th><th className="text-left">Value</th><th className="text-left">Uses</th><th className="text-left">Status</th><th></th></tr>
          </thead>
          <tbody>
            {coupons.map((c: any) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3 font-mono font-semibold">{c.code}</td>
                <td>{labelType(c.discount_type)}</td>
                <td>{valueText(c)}</td>
                <td>{c.usage_count}{c.usage_limit_total ? `/${c.usage_limit_total}` : ""}</td>
                <td><button onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                  className={`rounded-full px-3 py-1 text-xs ${c.active ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>{c.active ? "Active" : "Inactive"}</button></td>
                <td className="p-3 text-right"><button onClick={() => setEditing({ ...emptyDraft("seller"), ...c })} className="text-xs text-primary hover:underline">Edit</button></td>
              </tr>
            ))}
            {coupons.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No offers yet — try a preset above.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <CouponForm draft={editing} onChange={setEditing} onSave={() => save.mutate(editing)} onCancel={() => setEditing(null)} saving={save.isPending} role="seller" />
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
