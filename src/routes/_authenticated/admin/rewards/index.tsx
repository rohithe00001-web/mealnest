import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReferralAnalytics, getWheelAnalytics } from "@/lib/rewards-admin.functions";
import { Users2, Disc, Coins, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/rewards/")({
  component: Overview,
});

function StatCard({ icon: Icon, label, value, hint }: any) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wider">{label}</span></div>
      <div className="mt-2 text-3xl font-display font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function Overview() {
  const ref = useServerFn(getReferralAnalytics);
  const wheel = useServerFn(getWheelAnalytics);
  const { data: r } = useQuery({ queryKey: ["rewards-analytics-ref"], queryFn: () => ref() });
  const { data: w } = useQuery({ queryKey: ["rewards-analytics-wheel"], queryFn: () => wheel() });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard icon={Users2} label="Total referrals" value={r?.total ?? 0} hint={`${r?.successful ?? 0} rewarded`} />
      <StatCard icon={TrendingUp} label="Conversion" value={`${r?.conversion ?? 0}%`} />
      <StatCard icon={Disc} label="Wheel spins" value={w?.total ?? 0} hint={`Top: ${w?.topPrize ?? "—"}`} />
      <StatCard icon={Coins} label="Reward cost" value={`₹${w?.cost ?? 0}`} hint="Approx (coins+coupons)" />
    </div>
  );
}
