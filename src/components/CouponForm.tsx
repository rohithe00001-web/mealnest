import { type Dispatch, type SetStateAction } from "react";

export const FESTIVALS = ["Ugadi", "Sankranti", "Dasara", "Diwali", "Eid", "Christmas"];

export interface CouponDraft {
  id?: string;
  code: string;
  description?: string | null;
  scope: "platform" | "seller" | "category";
  seller_id?: string | null;
  discount_type: "flat" | "percent" | "free_delivery" | "partial_delivery";
  discount_flat?: number | null;
  discount_percent?: number | null;
  max_discount?: number | null;
  min_order: number;
  usage_limit_total?: number | null;
  usage_limit_per_user: number;
  starts_at?: string | null;
  expires_at?: string | null;
  applies_to: "order" | "subscription" | "both";
  subscription_plan_types: string[];
  category_ids: string[];
  cuisine_tags: string[];
  geo_pincodes: string[];
  festival_tag?: string | null;
  new_customers_only: boolean;
  active: boolean;
  metadata: Record<string, any>;
}

export function CouponForm({
  draft, onChange, onSave, onCancel, saving, role,
}: {
  draft: CouponDraft;
  onChange: Dispatch<SetStateAction<CouponDraft | null>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  role: "admin" | "seller";
}) {
  const update = (patch: Partial<CouponDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl font-semibold">{draft.id ? "Edit" : "Create"} coupon</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Code"><input value={draft.code} onChange={(e) => update({ code: e.target.value.toUpperCase() })} className={inp} placeholder="MEAL50" /></Field>
          <Field label="Description"><input value={draft.description ?? ""} onChange={(e) => update({ description: e.target.value })} className={inp} /></Field>

          <Field label="Discount type">
            <select value={draft.discount_type} onChange={(e) => update({ discount_type: e.target.value as any })} className={inp}>
              <option value="flat">Flat ₹ off</option>
              <option value="percent">Percentage off</option>
              <option value="free_delivery">Free delivery</option>
              <option value="partial_delivery">Delivery discount</option>
            </select>
          </Field>
          <Field label="Applies to">
            <select value={draft.applies_to} onChange={(e) => update({ applies_to: e.target.value as any })} className={inp}>
              <option value="order">Orders</option>
              <option value="subscription">Subscriptions</option>
              <option value="both">Both</option>
            </select>
          </Field>

          {draft.discount_type === "flat" || draft.discount_type === "partial_delivery" ? (
            <Field label="Amount (₹)"><input type="number" min={0} value={draft.discount_flat ?? 0} onChange={(e) => update({ discount_flat: Number(e.target.value) })} className={inp} /></Field>
          ) : null}
          {draft.discount_type === "percent" && (
            <>
              <Field label="Percent (%)"><input type="number" min={0} max={100} value={draft.discount_percent ?? 0} onChange={(e) => update({ discount_percent: Number(e.target.value) })} className={inp} /></Field>
              <Field label="Max discount (₹)"><input type="number" min={0} value={draft.max_discount ?? ""} onChange={(e) => update({ max_discount: e.target.value ? Number(e.target.value) : null })} className={inp} /></Field>
            </>
          )}

          <Field label="Minimum order (₹)"><input type="number" min={0} value={draft.min_order} onChange={(e) => update({ min_order: Number(e.target.value) })} className={inp} /></Field>
          <Field label="Total usage limit"><input type="number" min={1} value={draft.usage_limit_total ?? ""} onChange={(e) => update({ usage_limit_total: e.target.value ? Number(e.target.value) : null })} className={inp} placeholder="Unlimited" /></Field>
          <Field label="Per-user limit"><input type="number" min={1} value={draft.usage_limit_per_user} onChange={(e) => update({ usage_limit_per_user: Number(e.target.value) })} className={inp} /></Field>

          <Field label="Starts at"><input type="datetime-local" value={toLocal(draft.starts_at)} onChange={(e) => update({ starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className={inp} /></Field>
          <Field label="Expires at"><input type="datetime-local" value={toLocal(draft.expires_at)} onChange={(e) => update({ expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className={inp} /></Field>

          {draft.applies_to !== "order" && (
            <Field label="Subscription plan types (comma)"><input value={draft.subscription_plan_types.join(",")} onChange={(e) => update({ subscription_plan_types: csv(e.target.value) })} className={inp} placeholder="weekly,monthly,family" /></Field>
          )}

          {role === "admin" && (
            <>
              <Field label="Festival">
                <select value={draft.festival_tag ?? ""} onChange={(e) => update({ festival_tag: e.target.value || null })} className={inp}>
                  <option value="">—</option>
                  {FESTIVALS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Scope">
                <select value={draft.scope} onChange={(e) => update({ scope: e.target.value as any })} className={inp}>
                  <option value="platform">Platform-wide</option>
                  <option value="category">Category</option>
                </select>
              </Field>
            </>
          )}

          <Field label="Pincodes (comma)"><input value={draft.geo_pincodes.join(",")} onChange={(e) => update({ geo_pincodes: csv(e.target.value) })} className={inp} placeholder="500001,500002" /></Field>
          <Field label="Cuisine tags (comma)"><input value={draft.cuisine_tags.join(",")} onChange={(e) => update({ cuisine_tags: csv(e.target.value) })} className={inp} /></Field>

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.new_customers_only} onChange={(e) => update({ new_customers_only: e.target.checked })} /> New customers only</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => update({ active: e.target.checked })} /> Active</label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} className="h-10 rounded-full border border-border px-4 text-sm">Cancel</button>
          <button onClick={onSave} disabled={saving || !draft.code} className="h-10 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save coupon"}</button>
        </div>
      </div>
    </div>
  );
}

const inp = "mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
function csv(s: string): string[] { return s.split(",").map((x) => x.trim()).filter(Boolean); }
function toLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
