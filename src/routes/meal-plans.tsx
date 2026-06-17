import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar, Leaf, Star, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { listSubscriptionMarketplace, aiRecommendPlans } from "@/lib/subscriptions.functions";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/meal-plans")({
  head: () => ({
    meta: [
      { title: "Meal Plans — Weekly, 15-Day & Monthly Subscriptions | HomeBite" },
      { name: "description", content: "Subscribe to homemade meal plans from local kitchens. Choose weekly, 15-day or monthly plans with daily delivery." },
      { property: "og:title", content: "HomeBite Meal Subscriptions" },
      { property: "og:description", content: "Daily homemade meals, delivered. Weekly / 15-day / monthly plans." },
    ],
  }),
  component: MealPlansBrowse,
});

function MealPlansBrowse() {
  const listFn = useServerFn(listSubscriptionMarketplace);
  const [planType, setPlanType] = useState<"" | "weekly" | "half_month" | "monthly">("");
  const [vegOnly, setVegOnly] = useState(false);
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["meal-plans", planType, vegOnly],
    queryFn: () => listFn({ data: { plan_type: (planType || undefined) as any, is_veg: vegOnly || undefined } }),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8 space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Subscriptions</p>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Meal Plans</h1>
          <p className="mt-2 text-muted-foreground">Subscribe once. Eat home-cooked meals every day.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { v: "", l: "All" },
            { v: "weekly", l: "Weekly (7 days)" },
            { v: "half_month", l: "15-Day" },
            { v: "monthly", l: "Monthly (30 days)" },
          ].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setPlanType(opt.v as any)}
              className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${
                planType === opt.v ? "bg-primary text-primary-foreground" : "border border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.l}
            </button>
          ))}
          <button
            onClick={() => setVegOnly((v) => !v)}
            className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${
              vegOnly ? "bg-success text-white" : "border border-border bg-surface text-muted-foreground"
            }`}
          >
            <Leaf className="mr-1 inline h-4 w-4" /> Veg only
          </button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading meal plans…</p>
        ) : plans.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
            No meal plans available yet. Check back soon.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(plans as any[]).map((p) => {
              const costPerMeal = Number(p.price_per_person) / p.duration_days;
              return (
                <Link
                  key={p.id}
                  to="/meal-plans/$id"
                  params={{ id: p.id }}
                  className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="aspect-[16/9] bg-muted overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-muted-foreground">
                        <Calendar className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-primary">
                        {p.plan_type.replace("_", " ")}
                      </span>
                      {p.is_veg && <span className="text-success"><Leaf className="h-4 w-4" /></span>}
                    </div>
                    <h3 className="font-medium line-clamp-1">{p.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">{p.sellers?.kitchen_name} · {p.sellers?.city}</p>
                    {p.cuisines?.length > 0 && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{p.cuisines.join(" · ")}</p>
                    )}
                    <div className="flex items-end justify-between pt-2">
                      <div>
                        <p className="font-display text-xl font-semibold">{inr(Number(p.price_per_person))}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.duration_days} days · ~{inr(costPerMeal)}/day
                        </p>
                      </div>
                      {p.sellers?.rating_count > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {Number(p.sellers.rating_avg).toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
