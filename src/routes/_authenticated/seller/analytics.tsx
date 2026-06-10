import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar,
} from "recharts";
import { IndianRupee, ShoppingBag, Users, Repeat, TrendingUp } from "lucide-react";
import { getSellerAnalytics } from "@/lib/seller.functions";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/seller/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const fn = useServerFn(getSellerAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["seller", "analytics", days],
    queryFn: () => fn({ data: { days } }),
  });

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;

  const t = data.totals;
  const cards = [
    { label: "Revenue", value: inr(t.revenue), icon: IndianRupee },
    { label: "Orders", value: t.orders, icon: ShoppingBag },
    { label: "Avg order value", value: inr(Math.round(t.aov)), icon: TrendingUp },
    { label: "Customers", value: t.customers, icon: Users },
    { label: "Repeat rate", value: `${t.repeatRate}%`, icon: Repeat },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Analytics</h2>
        <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${days === d ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 font-display text-2xl font-semibold">{c.value}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-display text-lg font-semibold">Revenue over time</h3>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.daily} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => inr(Number(v))}
              />
              <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" fill="url(#rev)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="font-display text-lg font-semibold">Top dishes</h3>
          {data.topDishes.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No sales in this period.</p>
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topDishes} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="qty" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="font-display text-lg font-semibold">Customer loyalty</h3>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Repeat customers</span>
                <span className="font-medium">{t.repeatCustomers} of {t.customers}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${t.repeatRate}%` }} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t.repeatRate >= 30
                ? "Strong loyalty — keep delighting them."
                : t.repeatRate >= 15
                ? "Building loyalty. Consider a small thank-you offer."
                : "Most customers are first-timers. Quality and on-time delivery drive repeats."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
