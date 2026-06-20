import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Gift, Users2, Disc, BarChart3, ScrollText, Smartphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/rewards")({
  component: RewardsAdminLayout,
});

const TABS = [
  { to: "/admin/rewards", label: "Overview", icon: Gift, exact: true },
  { to: "/admin/rewards/referrals", label: "Referral Program", icon: Users2 },
  { to: "/admin/rewards/wheels", label: "Mystery Wheels", icon: Disc },
  { to: "/admin/rewards/devices", label: "Devices", icon: Smartphone },
  { to: "/admin/rewards/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/rewards/audit", label: "Audit Log", icon: ScrollText },
];

function RewardsAdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">Rewards & Promotions</h2>
        <p className="text-sm text-muted-foreground">Configure referrals, mystery wheels, probabilities and limits in real time.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to} className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
