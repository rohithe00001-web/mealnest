import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { listMySubscriptions } from "@/lib/subscriptions.functions";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/my-subscriptions")({
  component: MySubscriptions,
});

function MySubscriptions() {
  const listFn = useServerFn(listMySubscriptions);
  const { data: subs = [], isLoading } = useQuery({ queryKey: ["my-subs"], queryFn: () => listFn() });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8 space-y-4">
        <h1 className="font-display text-3xl font-semibold">My Subscriptions</h1>
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : subs.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
            No subscriptions yet. <Link to="/meal-plans" className="text-primary hover:underline">Browse meal plans</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {(subs as any[]).map((s) => (
              <Link key={s.id} to="/my-subscriptions/$id" params={{ id: s.id }}
                className="block rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{s.subscription_plans?.title}</p>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.sellers?.kitchen_name} · {s.start_date} → {s.end_date} · {s.people_count} person(s)
                    </p>
                  </div>
                  <p className="font-display text-lg font-semibold">{inr(Number(s.total_price))}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = {
    active: "bg-emerald-100 text-emerald-800",
    paused: "bg-amber-100 text-amber-800",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-rose-100 text-rose-800",
  }[status] ?? "bg-muted";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}
