import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReferralAnalytics, getWheelAnalytics } from "@/lib/rewards-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/rewards/analytics")({
  component: Analytics,
});

function Analytics() {
  const ref = useServerFn(getReferralAnalytics);
  const wheel = useServerFn(getWheelAnalytics);
  const { data: r } = useQuery({ queryKey: ["rew-an-ref"], queryFn: () => ref() });
  const { data: w } = useQuery({ queryKey: ["rew-an-wheel"], queryFn: () => wheel() });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="text-lg font-semibold mb-3">Referrals</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span>Total referrals</span><span className="font-semibold">{r?.total ?? 0}</span></div>
          <div className="flex justify-between"><span>Successful (rewarded)</span><span className="font-semibold">{r?.successful ?? 0}</span></div>
          <div className="flex justify-between"><span>Conversion</span><span className="font-semibold">{r?.conversion ?? 0}%</span></div>
          <div className="flex justify-between"><span>Active campaigns</span><span className="font-semibold">{(r?.campaigns ?? []).filter((c: any) => c.active).length}</span></div>
          <div className="flex justify-between"><span>Recent fraud events</span><span className="font-semibold text-rose-600">{r?.fraudEvents?.length ?? 0}</span></div>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="text-lg font-semibold mb-3">Mystery Wheel</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span>Total spins</span><span className="font-semibold">{w?.total ?? 0}</span></div>
          <div className="flex justify-between"><span>Approx reward cost</span><span className="font-semibold">₹{w?.cost ?? 0}</span></div>
          <div className="flex justify-between"><span>Top reward</span><span className="font-semibold">{w?.topPrize ?? "—"}</span></div>
          <div className="mt-3">
            <div className="text-xs text-muted-foreground mb-1">Breakdown by prize type</div>
            <ul className="text-sm space-y-1">
              {Object.entries(w?.byPrize ?? {}).map(([k, v]) => (
                <li key={k} className="flex justify-between"><span>{k}</span><span className="font-medium">{v as number}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
