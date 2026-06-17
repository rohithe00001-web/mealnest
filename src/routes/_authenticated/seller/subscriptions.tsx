import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import {
  listSellerSubscriptions, listSellerDeliveriesToday, markDeliveryDelivered,
} from "@/lib/subscriptions.functions";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seller/subscriptions")({
  component: SellerSubsPage,
});

function SellerSubsPage() {
  const subsFn = useServerFn(listSellerSubscriptions);
  const todayFn = useServerFn(listSellerDeliveriesToday);
  const markFn = useServerFn(markDeliveryDelivered);
  const qc = useQueryClient();
  const { data: subs = [] } = useQuery({ queryKey: ["seller", "subs"], queryFn: () => subsFn() });
  const { data: today = [] } = useQuery({ queryKey: ["seller", "deliveries-today"], queryFn: () => todayFn() });
  const markMut = useMutation({
    mutationFn: (d: string) => markFn({ data: { delivery_id: d } }),
    onSuccess: () => { toast.success("Marked delivered"); qc.invalidateQueries({ queryKey: ["seller", "deliveries-today"] }); },
  });

  const active = (subs as any[]).filter((s) => s.status === "active");
  const revenue = (subs as any[]).reduce((sum, s) => s.status !== "cancelled" ? sum + Number(s.total_price) : sum, 0);
  const planCounts = new Map<string, number>();
  (subs as any[]).forEach((s) => {
    const t = s.subscription_plans?.title ?? "Unknown";
    planCounts.set(t, (planCounts.get(t) ?? 0) + 1);
  });
  const topPlans = Array.from(planCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active subscribers" value={String(active.length)} />
        <Stat label="Total subscriptions" value={String(subs.length)} />
        <Stat label="Revenue" value={inr(revenue)} />
        <Stat label="Today's deliveries" value={String(today.length)} />
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border p-4 font-medium">Today's deliveries</div>
        {today.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nothing scheduled for today.</p>
        ) : (
          <div className="divide-y divide-border">
            {(today as any[]).map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.subscriptions?.delivery_address?.label} — {d.subscriptions?.delivery_address?.address_line}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.subscriptions?.people_count} person(s) · {d.subscriptions?.meal_selection?.replace("_", " ")} · {d.subscriptions?.delivery_slot}
                  </p>
                  <p className="mt-1 text-xs">
                    {d.meals?.breakfast_name && <>🌅 {d.meals.breakfast_name}  </>}
                    {d.meals?.lunch_name && <>🍱 {d.meals.lunch_name}  </>}
                    {d.meals?.dinner_name && <>🌙 {d.meals.dinner_name}</>}
                  </p>
                </div>
                <button onClick={() => markMut.mutate(d.id)} className="inline-flex h-9 items-center gap-1 rounded-full bg-success px-3 text-xs font-medium text-white">
                  <Check className="h-3 w-3" /> Delivered
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border p-4 font-medium">All subscriptions</div>
          {subs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No subscriptions yet.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
              {(subs as any[]).map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.subscription_plans?.title}</p>
                    <p className="text-xs text-muted-foreground">{s.start_date} → {s.end_date} · {s.people_count}p · {s.status}</p>
                  </div>
                  <p className="font-medium">{inr(Number(s.total_price))}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border p-4 font-medium">Top plans</div>
          {topPlans.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {topPlans.map(([t, c]) => (
                <li key={t} className="flex justify-between p-3 text-sm">
                  <span className="truncate">{t}</span>
                  <span className="font-medium">{c} subs</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
    </div>
  );
}
