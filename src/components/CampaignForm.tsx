import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type CampaignFormValues = {
  id?: string;
  name: string;
  description?: string | null;
  type: "festival" | "happy_hour" | "flash_sale" | "combo" | "family_plan" | "corporate" | "weather";
  banner_image?: string | null;
  config: Record<string, any>;
  discount_type?: "flat" | "percent" | "free_delivery" | "combo_price" | null;
  discount_value: number;
  max_discount?: number | null;
  min_order: number;
  starts_at: string;
  ends_at?: string | null;
  audience_limit?: number | null;
  active: boolean;
  featured?: boolean;
};

const FESTIVAL_PRESETS: Array<Partial<CampaignFormValues> & { label: string }> = [
  { label: "Diwali Feast", name: "Diwali Feast", type: "festival", discount_type: "percent", discount_value: 20, config: { tag: "diwali" } },
  { label: "Christmas Cheer", name: "Christmas Cheer", type: "festival", discount_type: "percent", discount_value: 15, config: { tag: "christmas" } },
  { label: "Eid Special", name: "Eid Special", type: "festival", discount_type: "flat", discount_value: 100, config: { tag: "eid" } },
  { label: "New Year Brunch", name: "New Year Brunch", type: "festival", discount_type: "percent", discount_value: 25, config: { tag: "newyear" } },
];

export function CampaignForm({
  initial,
  showFeatured = false,
  onSubmit,
  submitting,
}: {
  initial?: Partial<CampaignFormValues>;
  showFeatured?: boolean;
  onSubmit: (v: CampaignFormValues) => void;
  submitting?: boolean;
}) {
  const [v, setV] = useState<CampaignFormValues>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    type: (initial?.type as any) ?? "festival",
    banner_image: initial?.banner_image ?? "",
    config: initial?.config ?? {},
    discount_type: (initial?.discount_type as any) ?? "percent",
    discount_value: initial?.discount_value ?? 10,
    max_discount: initial?.max_discount ?? null,
    min_order: initial?.min_order ?? 0,
    starts_at: initial?.starts_at ?? new Date().toISOString().slice(0, 16),
    ends_at: initial?.ends_at ?? null,
    audience_limit: initial?.audience_limit ?? null,
    active: initial?.active ?? true,
    featured: initial?.featured ?? false,
    id: initial?.id,
  });

  const set = (patch: Partial<CampaignFormValues>) => setV((x) => ({ ...x, ...patch }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}
      className="space-y-4"
    >
      {showFeatured && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Festival presets</div>
          <div className="flex flex-wrap gap-2">
            {FESTIVAL_PRESETS.map((p) => (
              <button key={p.label} type="button"
                className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
                onClick={() => set(p as any)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Name</Label>
          <Input value={v.name} onChange={(e) => set({ name: e.target.value })} required />
        </div>
        <div>
          <Label>Type</Label>
          <select
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={v.type}
            onChange={(e) => set({ type: e.target.value as any })}
          >
            <option value="festival">Festival</option>
            <option value="happy_hour">Happy Hour</option>
            <option value="flash_sale">Flash Sale</option>
            <option value="combo">Combo</option>
            <option value="family_plan">Family Plan</option>
            <option value="corporate">Corporate</option>
            <option value="weather">Weather-based</option>
          </select>
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea rows={2} value={v.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Discount type</Label>
          <select
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={v.discount_type ?? ""}
            onChange={(e) => set({ discount_type: (e.target.value || null) as any })}
          >
            <option value="percent">Percent</option>
            <option value="flat">Flat ₹</option>
            <option value="free_delivery">Free delivery</option>
            <option value="combo_price">Combo price</option>
          </select>
        </div>
        <div>
          <Label>Value</Label>
          <Input type="number" min={0} value={v.discount_value}
            onChange={(e) => set({ discount_value: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Max discount (₹)</Label>
          <Input type="number" min={0} value={v.max_discount ?? ""}
            onChange={(e) => set({ max_discount: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Min order (₹)</Label>
          <Input type="number" min={0} value={v.min_order}
            onChange={(e) => set({ min_order: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Audience limit</Label>
          <Input type="number" min={1} value={v.audience_limit ?? ""}
            onChange={(e) => set({ audience_limit: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div>
          <Label>Banner image URL</Label>
          <Input value={v.banner_image ?? ""} onChange={(e) => set({ banner_image: e.target.value })} placeholder="https://…" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Starts at</Label>
          <Input type="datetime-local" value={v.starts_at?.slice(0, 16) ?? ""}
            onChange={(e) => set({ starts_at: new Date(e.target.value).toISOString() })} />
        </div>
        <div>
          <Label>Ends at</Label>
          <Input type="datetime-local" value={v.ends_at ? v.ends_at.slice(0, 16) : ""}
            onChange={(e) => set({ ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        </div>
      </div>

      {v.type === "happy_hour" && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <Label className="text-xs">Daily window (HH:MM-HH:MM)</Label>
          <Input
            placeholder="15:00-17:00"
            value={v.config?.window ?? ""}
            onChange={(e) => set({ config: { ...v.config, window: e.target.value } })}
          />
        </div>
      )}

      {v.type === "weather" && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <Label className="text-xs">Trigger condition</Label>
          <select
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={v.config?.weather ?? "rainy"}
            onChange={(e) => set({ config: { ...v.config, weather: e.target.value } })}
          >
            <option value="rainy">Rainy day</option>
            <option value="hot">Hot day</option>
            <option value="cold">Cold day</option>
          </select>
        </div>
      )}

      <div className="flex items-center gap-6 pt-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.active} onChange={(e) => set({ active: e.target.checked })} />
          Active
        </label>
        {showFeatured && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!v.featured} onChange={(e) => set({ featured: e.target.checked })} />
            Feature on home page
          </label>
        )}
      </div>

      <Button type="submit" disabled={submitting}>{v.id ? "Save campaign" : "Create campaign"}</Button>
    </form>
  );
}