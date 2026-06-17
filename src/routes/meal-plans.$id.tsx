import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Leaf, Star, Calendar, Flame } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSubscriptionPlanDetail, createSubscription } from "@/lib/subscriptions.functions";
import { listAddresses } from "@/lib/customer.functions";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/meal-plans/$id")({
  component: PlanDetail,
});

const MEAL_SELECTIONS = [
  { v: "breakfast_only", l: "Breakfast only" },
  { v: "lunch_only", l: "Lunch only" },
  { v: "dinner_only", l: "Dinner only" },
  { v: "breakfast_lunch", l: "Breakfast + Lunch" },
  { v: "lunch_dinner", l: "Lunch + Dinner" },
  { v: "full_day", l: "Full day (all 3)" },
];

function PlanDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const detailFn = useServerFn(getSubscriptionPlanDetail);
  const addressFn = useServerFn(listAddresses);
  const subFn = useServerFn(createSubscription);
  const { data: plan, isLoading } = useQuery({
    queryKey: ["plan-detail", id],
    queryFn: () => detailFn({ data: { id } }),
    enabled: !!user,
  });
  const { data: addresses = [] } = useQuery({
    queryKey: ["addresses"], queryFn: () => addressFn(), enabled: !!user,
  });

  const [activeDay, setActiveDay] = useState(1);
  const [people, setPeople] = useState(1);
  const [mealSelection, setMealSelection] = useState("full_day");
  const [addressId, setAddressId] = useState("");
  const [slot, setSlot] = useState("lunch");
  const [startDate, setStartDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [excludeStr, setExcludeStr] = useState("");
  const [spice, setSpice] = useState<"mild" | "medium" | "spicy">("medium");
  const [diet, setDiet] = useState<"veg" | "non_veg" | "vegan">("veg");
  const [allergiesStr, setAllergiesStr] = useState("");

  const subMut = useMutation({
    mutationFn: () =>
      subFn({
        data: {
          plan_id: id, people_count: people, meal_selection: mealSelection as any,
          address_id: addressId, delivery_slot: slot, start_date: startDate,
          customizations: {
            exclude_dishes: excludeStr.split(",").map((s) => s.trim()).filter(Boolean),
            spice_level: spice, diet,
            allergies: allergiesStr.split(",").map((s) => s.trim()).filter(Boolean),
          },
        },
      }),
    onSuccess: (r) => {
      toast.success("Subscription created!");
      navigate({ to: "/my-subscriptions/$id", params: { id: r.id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="container-page flex-1 py-16 text-center">
          <p className="mb-4 text-muted-foreground">Sign in to view this meal plan.</p>
          <Link to="/auth" className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">Sign in</Link>
        </main>
      </div>
    );
  }
  if (isLoading || !plan) return <div className="min-h-screen flex flex-col"><Header /><main className="container-page flex-1 py-16 text-muted-foreground">Loading…</main></div>;

  const total = Number((plan as any).price_per_person) * people;
  const days = ((plan as any).subscription_plan_days ?? []).sort((a: any, b: any) => a.day_number - b.day_number);
  const dayMap = new Map(days.map((d: any) => [d.day_number, d]));
  const cur: any = dayMap.get(activeDay) ?? {};

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8 space-y-6">
        <Link to="/meal-plans" className="text-sm text-muted-foreground hover:underline">← All meal plans</Link>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-muted">
              {(plan as any).image_url ? (
                <img src={(plan as any).image_url} alt={(plan as any).title} className="h-full w-full object-cover" />
              ) : <div className="h-full w-full grid place-items-center text-muted-foreground"><Calendar className="h-12 w-12" /></div>}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold uppercase text-primary">{(plan as any).plan_type.replace("_", " ")}</span>
                {(plan as any).is_veg && <Leaf className="h-5 w-5 text-success" />}
                {(plan as any).sellers?.rating_count > 0 && (
                  <span className="flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {Number((plan as any).sellers.rating_avg).toFixed(1)}</span>
                )}
              </div>
              <h1 className="mt-2 font-display text-3xl font-semibold">{(plan as any).title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">By <strong>{(plan as any).sellers?.kitchen_name}</strong> · {(plan as any).sellers?.city}</p>
              {(plan as any).description && <p className="mt-3 text-sm">{(plan as any).description}</p>}
              {(plan as any).cuisines?.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Cuisines: {(plan as any).cuisines.join(" · ")}</p>}
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-medium mb-3">Day-by-day menu ({(plan as any).duration_days} days)</h3>
              <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
                {Array.from({ length: (plan as any).duration_days }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setActiveDay(n)}
                    className={`h-9 min-w-[64px] shrink-0 rounded-lg px-3 text-xs font-medium ${
                      activeDay === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    Day {n}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {(["breakfast", "lunch", "dinner"] as const).map((m) => {
                  const name = cur[`${m}_name`];
                  const desc = cur[`${m}_desc`];
                  if (!(plan as any).meal_types?.includes(m)) return null;
                  return (
                    <div key={m} className="rounded-lg border border-border p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground capitalize">{m}</p>
                      <p className="mt-1 font-medium">{name || <span className="italic text-muted-foreground">Not set</span>}</p>
                      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
                    </div>
                  );
                })}
                {(cur.calories > 0 || cur.protein_g > 0) && (
                  <div className="flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Flame className="h-3 w-3" /> {cur.calories} kcal</span>
                    <span>Protein {cur.protein_g}g</span>
                    <span>Carbs {cur.carbs_g}g</span>
                    <span>Fat {cur.fat_g}g</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="sticky top-20 rounded-2xl border border-border bg-card p-5 space-y-3">
              <p className="font-display text-3xl font-semibold">{inr(Number((plan as any).price_per_person))}<span className="text-sm font-normal text-muted-foreground"> / person</span></p>
              <p className="text-xs text-muted-foreground">{(plan as any).duration_days} days · ~{inr(Number((plan as any).price_per_person) / (plan as any).duration_days)} per day</p>

              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">People</span>
                <input type="number" min={1} max={20} value={people} onChange={(e) => setPeople(Math.max(1, Number(e.target.value)))} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Meals</span>
                <select value={mealSelection} onChange={(e) => setMealSelection(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                  {MEAL_SELECTIONS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Start date</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Delivery slot</span>
                <select value={slot} onChange={(e) => setSlot(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="breakfast">Morning (7–9 AM)</option>
                  <option value="lunch">Lunch (12–2 PM)</option>
                  <option value="dinner">Dinner (7–9 PM)</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Address</span>
                <select value={addressId} onChange={(e) => setAddressId(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="">Select address…</option>
                  {(addresses as any[]).map((a) => <option key={a.id} value={a.id}>{a.label} — {a.address_line}, {a.city}</option>)}
                </select>
                {addresses.length === 0 && <Link to="/addresses" className="mt-1 text-xs text-primary hover:underline">+ Add an address</Link>}
              </label>

              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">Customizations</summary>
                <div className="mt-3 space-y-2 text-sm">
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Spice level</span>
                    <select value={spice} onChange={(e) => setSpice(e.target.value as any)} className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
                      <option value="mild">Mild</option>
                      <option value="medium">Medium</option>
                      <option value="spicy">Spicy</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Diet</span>
                    <select value={diet} onChange={(e) => setDiet(e.target.value as any)} className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
                      <option value="veg">Vegetarian</option>
                      <option value="non_veg">Non-vegetarian</option>
                      <option value="vegan">Vegan</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Exclude dishes (comma)</span>
                    <input value={excludeStr} onChange={(e) => setExcludeStr(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Allergies (comma)</span>
                    <input value={allergiesStr} onChange={(e) => setAllergiesStr(e.target.value)} placeholder="peanuts, dairy" className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" />
                  </label>
                </div>
              </details>

              <div className="border-t border-border pt-3">
                <p className="flex justify-between text-sm"><span>Total ({people}×)</span><span className="font-medium">{inr(total)}</span></p>
                <p className="text-xs text-muted-foreground">Cash on delivery</p>
              </div>
              <button
                disabled={!addressId || subMut.isPending}
                onClick={() => subMut.mutate()}
                className="h-11 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {subMut.isPending ? "Subscribing…" : "Subscribe"}
              </button>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
