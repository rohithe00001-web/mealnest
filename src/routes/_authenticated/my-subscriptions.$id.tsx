import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, X, SkipForward, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  getMySubscriptionDetail, skipDelivery, pauseSubscription, cancelSubscription,
  aiNutritionSummary,
} from "@/lib/subscriptions.functions";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-subscriptions/$id")({
  component: SubscriptionDetail,
});

function SubscriptionDetail() {
  const { id } = Route.useParams();
  const detailFn = useServerFn(getMySubscriptionDetail);
  const skipFn = useServerFn(skipDelivery);
  const pauseFn = useServerFn(pauseSubscription);
  const cancelFn = useServerFn(cancelSubscription);
  const nutritionFn = useServerFn(aiNutritionSummary);
  const qc = useQueryClient();
  const { data: sub, isLoading } = useQuery({
    queryKey: ["my-sub", id], queryFn: () => detailFn({ data: { id } }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-sub", id] });
  const skipMut = useMutation({ mutationFn: (d: string) => skipFn({ data: { delivery_id: d } }), onSuccess: () => { toast.success("Skipped — your plan was extended by 1 day"); refresh(); } });
  const pauseMut = useMutation({ mutationFn: (pause: boolean) => pauseFn({ data: { id, pause } }), onSuccess: () => { toast.success("Updated"); refresh(); } });
  const cancelMut = useMutation({ mutationFn: () => cancelFn({ data: { id } }), onSuccess: () => { toast.success("Cancelled"); refresh(); } });
  const nutritionMut = useMutation({
    mutationFn: () => nutritionFn({ data: { subscription_id: id } }),
    onError: (e: any) => toast.error(e.message ?? "Could not generate insights"),
  });

  if (isLoading || !sub) return <div className="min-h-screen flex flex-col"><Header /><main className="container-page flex-1 py-16 text-muted-foreground">Loading…</main></div>;
  const s: any = sub;
  const deliveries = (s.subscription_deliveries ?? []).sort((a: any, b: any) => a.scheduled_date.localeCompare(b.scheduled_date));

  function downloadIcs() {
    const events = deliveries.map((d: any) => {
      const dt = d.scheduled_date.replace(/-/g, "");
      const title = `${s.subscription_plans?.title} — Day ${d.day_number}`;
      return [
        "BEGIN:VEVENT",
        `UID:${d.id}@homebite`,
        `DTSTAMP:${dt}T120000Z`,
        `DTSTART;VALUE=DATE:${dt}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:Breakfast: ${d.meals?.breakfast_name || "-"}\\nLunch: ${d.meals?.lunch_name || "-"}\\nDinner: ${d.meals?.dinner_name || "-"}`,
        "END:VEVENT",
      ].join("\n");
    }).join("\n");
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//HomeBite//Meal Plan//EN\n${events}\nEND:VCALENDAR`;
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `meal-plan-${id.slice(0, 8)}.ics`;
    a.click();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8 space-y-6">
        <Link to="/my-subscriptions" className="text-sm text-muted-foreground hover:underline">← All subscriptions</Link>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold">{s.subscription_plans?.title}</h1>
              <p className="text-sm text-muted-foreground">{s.sellers?.kitchen_name} · {s.start_date} → {s.end_date}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.people_count} person(s) · {s.meal_selection.replace("_", " ")} · {s.delivery_slot}</p>
              {s.extension_days > 0 && <p className="mt-1 text-xs text-amber-700">Extended by {s.extension_days} day(s) due to skips</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={downloadIcs} className="h-9 rounded-full border border-border px-3 text-xs">Download calendar</button>
              {s.status === "active" && (
                <button onClick={() => pauseMut.mutate(true)} className="h-9 rounded-full border border-border px-3 text-xs inline-flex items-center gap-1">
                  <Pause className="h-3 w-3" /> Pause
                </button>
              )}
              {s.status === "paused" && (
                <button onClick={() => pauseMut.mutate(false)} className="h-9 rounded-full bg-primary px-3 text-xs text-primary-foreground inline-flex items-center gap-1">
                  <Play className="h-3 w-3" /> Resume
                </button>
              )}
              {s.status !== "cancelled" && s.status !== "completed" && (
                <button onClick={() => confirm("Cancel subscription?") && cancelMut.mutate()} className="h-9 rounded-full border border-destructive text-destructive px-3 text-xs inline-flex items-center gap-1">
                  <X className="h-3 w-3" /> Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border p-4 font-medium">Delivery schedule</div>
          <div className="divide-y divide-border">
            {deliveries.map((d: any) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="w-20 shrink-0">
                  <p className="text-xs text-muted-foreground">Day {d.day_number}</p>
                  <p className="font-medium">{d.scheduled_date}</p>
                </div>
                <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {d.meals?.breakfast_name && <span>🌅 {d.meals.breakfast_name}  </span>}
                  {d.meals?.lunch_name && <span>🍱 {d.meals.lunch_name}  </span>}
                  {d.meals?.dinner_name && <span>🌙 {d.meals.dinner_name}</span>}
                </div>
                <StatusDot status={d.status} />
                {d.status === "scheduled" && (
                  <button onClick={() => skipMut.mutate(d.id)} className="rounded-md p-2 text-xs hover:bg-muted inline-flex items-center gap-1">
                    <SkipForward className="h-3 w-3" /> Skip
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">Total paid: <strong>{inr(Number(s.total_price))}</strong> · {s.payment_status}</p>
      </main>
      <Footer />
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const cls = {
    scheduled: "bg-primary/10 text-primary",
    delivered: "bg-emerald-100 text-emerald-700",
    skipped: "bg-amber-100 text-amber-700",
    paused: "bg-muted text-muted-foreground",
  }[status] ?? "bg-muted";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}
