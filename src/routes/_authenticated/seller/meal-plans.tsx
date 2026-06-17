import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Copy, Send } from "lucide-react";
import {
  listSellerPlans,
  deleteSubscriptionPlan,
  duplicateSubscriptionPlan,
  upsertSubscriptionPlan,
} from "@/lib/subscriptions.functions";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seller/meal-plans")({
  component: SellerMealPlans,
});

function SellerMealPlans() {
  const listFn = useServerFn(listSellerPlans);
  const delFn = useServerFn(deleteSubscriptionPlan);
  const dupFn = useServerFn(duplicateSubscriptionPlan);
  const saveFn = useServerFn(upsertSubscriptionPlan);
  const qc = useQueryClient();
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["seller", "meal-plans"],
    queryFn: () => listFn(),
  });
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["seller", "meal-plans"] });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { refresh(); toast.success("Deleted"); },
  });
  const dupMut = useMutation({
    mutationFn: (id: string) => dupFn({ data: { id } }),
    onSuccess: () => { refresh(); toast.success("Duplicated"); },
  });
  const submitMut = useMutation({
    mutationFn: (plan: any) =>
      saveFn({
        data: {
          id: plan.id,
          title: plan.title,
          description: plan.description ?? "",
          plan_type: plan.plan_type,
          duration_days: plan.duration_days,
          meal_types: plan.meal_types,
          price_per_person: Number(plan.price_per_person),
          cuisines: plan.cuisines ?? [],
          is_veg: plan.is_veg,
          image_url: plan.image_url ?? "",
          submit_for_review: true,
          days: (plan.subscription_plan_days ?? []).map((d: any) => ({
            day_number: d.day_number,
            breakfast_name: d.breakfast_name ?? "",
            breakfast_desc: d.breakfast_desc ?? "",
            lunch_name: d.lunch_name ?? "",
            lunch_desc: d.lunch_desc ?? "",
            dinner_name: d.dinner_name ?? "",
            dinner_desc: d.dinner_desc ?? "",
            calories: d.calories ?? 0,
            protein_g: d.protein_g ?? 0,
            carbs_g: d.carbs_g ?? 0,
            fat_g: d.fat_g ?? 0,
            is_veg: d.is_veg,
          })),
        },
      }),
    onSuccess: () => { refresh(); toast.success("Submitted for review"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (editingId !== null) {
    const existing = editingId === "new" ? null : (plans as any[]).find((p) => p.id === editingId);
    return <PlanEditor initial={existing} onDone={() => { setEditingId(null); refresh(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Meal subscription plans</h2>
        <button
          onClick={() => setEditingId("new")}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New plan
        </button>
      </div>
      <div className="rounded-xl border border-border bg-surface">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : plans.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No meal plans yet. Create your first one.</p>
        ) : (
          <div className="divide-y divide-border">
            {(plans as any[]).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{p.title}</p>
                    <StatusPill status={p.status} />
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase">{p.plan_type.replace("_", " ")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.duration_days} days · {inr(Number(p.price_per_person))} / person · {p.is_veg ? "Veg" : "Non-veg"} · {p.subscription_plan_days?.length ?? 0} days defined
                  </p>
                </div>
                <div className="flex gap-2">
                  {p.status === "draft" && (
                    <button onClick={() => submitMut.mutate(p)} className="rounded-md p-2 text-primary hover:bg-primary/10" title="Submit for review">
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => dupMut.mutate(p.id)} className="rounded-md p-2 hover:bg-muted" title="Duplicate">
                    <Copy className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingId(p.id)} className="rounded-md p-2 hover:bg-muted">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => confirm(`Delete ${p.title}?`) && delMut.mutate(p.id)}
                    className="rounded-md p-2 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = {
    draft: "bg-muted text-muted-foreground",
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-rose-100 text-rose-800",
  }[status] ?? "bg-muted";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

type DayForm = {
  day_number: number;
  breakfast_name: string; breakfast_desc: string;
  lunch_name: string; lunch_desc: string;
  dinner_name: string; dinner_desc: string;
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
  is_veg: boolean;
};

function emptyDays(n: number): DayForm[] {
  return Array.from({ length: n }, (_, i) => ({
    day_number: i + 1,
    breakfast_name: "", breakfast_desc: "",
    lunch_name: "", lunch_desc: "",
    dinner_name: "", dinner_desc: "",
    calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, is_veg: true,
  }));
}

function PlanEditor({ initial, onDone }: { initial: any; onDone: () => void }) {
  const saveFn = useServerFn(upsertSubscriptionPlan);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [planType, setPlanType] = useState<"weekly" | "half_month" | "monthly">(initial?.plan_type ?? "weekly");
  const duration = planType === "weekly" ? 7 : planType === "half_month" ? 15 : 30;
  const [mealTypes, setMealTypes] = useState<string[]>(initial?.meal_types ?? ["breakfast", "lunch", "dinner"]);
  const [price, setPrice] = useState(String(initial?.price_per_person ?? ""));
  const [cuisinesStr, setCuisinesStr] = useState((initial?.cuisines ?? []).join(", "));
  const [isVeg, setIsVeg] = useState(initial?.is_veg ?? true);
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [days, setDays] = useState<DayForm[]>(() => {
    if (initial?.subscription_plan_days?.length) {
      const map = new Map<number, DayForm>();
      initial.subscription_plan_days.forEach((d: any) => map.set(d.day_number, {
        day_number: d.day_number,
        breakfast_name: d.breakfast_name ?? "", breakfast_desc: d.breakfast_desc ?? "",
        lunch_name: d.lunch_name ?? "", lunch_desc: d.lunch_desc ?? "",
        dinner_name: d.dinner_name ?? "", dinner_desc: d.dinner_desc ?? "",
        calories: d.calories ?? 0, protein_g: d.protein_g ?? 0,
        carbs_g: d.carbs_g ?? 0, fat_g: d.fat_g ?? 0, is_veg: d.is_veg ?? true,
      }));
      const base = emptyDays(initial.duration_days ?? duration);
      return base.map((b) => map.get(b.day_number) ?? b);
    }
    return emptyDays(duration);
  });
  const [activeDay, setActiveDay] = useState(1);

  function onTypeChange(t: "weekly" | "half_month" | "monthly") {
    setPlanType(t);
    const newDur = t === "weekly" ? 7 : t === "half_month" ? 15 : 30;
    setDays((prev) => {
      const base = emptyDays(newDur);
      return base.map((b) => prev.find((p) => p.day_number === b.day_number) ?? b);
    });
    setActiveDay(1);
  }

  function updateDay(n: number, patch: Partial<DayForm>) {
    setDays((prev) => prev.map((d) => (d.day_number === n ? { ...d, ...patch } : d)));
  }

  const saveMut = useMutation({
    mutationFn: (submit: boolean) =>
      saveFn({
        data: {
          id: initial?.id,
          title, description, plan_type: planType,
          duration_days: duration as 7 | 15 | 30,
          meal_types: mealTypes as any,
          price_per_person: Number(price),
          cuisines: cuisinesStr.split(",").map((s: string) => s.trim()).filter(Boolean),
          is_veg: isVeg,
          image_url: imageUrl,
          submit_for_review: submit,
          days,
        },
      }),
    onSuccess: (_, submit) => {
      toast.success(submit ? "Submitted for review" : "Saved as draft");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cur = days[activeDay - 1];

  return (
    <div className="space-y-5">
      <button onClick={onDone} className="text-sm text-muted-foreground hover:underline">← Back to plans</button>
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h2 className="font-display text-xl font-semibold">{initial ? "Edit plan" : "New plan"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Title *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Plan duration *</span>
            <select value={planType} onChange={(e) => onTypeChange(e.target.value as any)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
              <option value="weekly">Weekly (7 days)</option>
              <option value="half_month">15-Day</option>
              <option value="monthly">Monthly (30 days)</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Price per person (₹) *</span>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Cuisines (comma separated)</span>
            <input value={cuisinesStr} onChange={(e) => setCuisinesStr(e.target.value)} placeholder="South Indian, Andhra, Tamil" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Cover image URL</span>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm" />
          </label>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isVeg} onChange={(e) => setIsVeg(e.target.checked)} /> Vegetarian plan
          </label>
          {(["breakfast", "lunch", "dinner"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2 capitalize">
              <input
                type="checkbox"
                checked={mealTypes.includes(m)}
                onChange={(e) => setMealTypes((prev) => e.target.checked ? [...prev, m] : prev.filter((x) => x !== m))}
              /> {m}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="font-medium">Day-by-day menu</h3>
        <div className="flex flex-wrap gap-1 overflow-x-auto pb-2">
          {days.map((d) => (
            <button
              key={d.day_number}
              onClick={() => setActiveDay(d.day_number)}
              className={`h-9 min-w-[60px] rounded-lg px-3 text-xs font-medium ${
                activeDay === d.day_number ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              Day {d.day_number}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {mealTypes.includes("breakfast") && (
            <MealRow label="Breakfast"
              name={cur.breakfast_name} desc={cur.breakfast_desc}
              onName={(v) => updateDay(cur.day_number, { breakfast_name: v })}
              onDesc={(v) => updateDay(cur.day_number, { breakfast_desc: v })} />
          )}
          {mealTypes.includes("lunch") && (
            <MealRow label="Lunch"
              name={cur.lunch_name} desc={cur.lunch_desc}
              onName={(v) => updateDay(cur.day_number, { lunch_name: v })}
              onDesc={(v) => updateDay(cur.day_number, { lunch_desc: v })} />
          )}
          {mealTypes.includes("dinner") && (
            <MealRow label="Dinner"
              name={cur.dinner_name} desc={cur.dinner_desc}
              onName={(v) => updateDay(cur.day_number, { dinner_name: v })}
              onDesc={(v) => updateDay(cur.day_number, { dinner_desc: v })} />
          )}

          <div className="grid grid-cols-4 gap-3">
            {(["calories", "protein_g", "carbs_g", "fat_g"] as const).map((k) => (
              <label key={k} className="block">
                <span className="text-xs font-medium text-muted-foreground capitalize">{k.replace("_g", " (g)")}</span>
                <input type="number" value={cur[k]} onChange={(e) => updateDay(cur.day_number, { [k]: Number(e.target.value) } as any)}
                  className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" />
              </label>
            ))}
          </div>

          {activeDay > 1 && (
            <button
              onClick={() => updateDay(activeDay, { ...days[0], day_number: activeDay })}
              className="text-xs text-primary hover:underline"
            >
              Copy Day 1 menu to Day {activeDay}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate(false)}
          className="h-11 flex-1 rounded-full border border-border bg-surface text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate(true)}
          className="h-11 flex-1 rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Submit for review
        </button>
      </div>
    </div>
  );
}

function MealRow({ label, name, desc, onName, onDesc }: { label: string; name: string; desc: string; onName: (v: string) => void; onDesc: (v: string) => void }) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <input value={name} onChange={(e) => onName(e.target.value)} placeholder={`${label} name (e.g. Idli & Sambar)`}
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
      <input value={desc} onChange={(e) => onDesc(e.target.value)} placeholder="Short description (optional)"
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
    </div>
  );
}
