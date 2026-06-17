import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Truck, Package, CheckCircle2, MapPin, Phone, KeyRound } from "lucide-react";
import { Header } from "@/components/Header";
import { agentListMyAssignments, agentUpdateAssignment } from "@/lib/delivery.functions";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/delivery/")({
  component: AgentDashboard,
});

function AgentDashboard() {
  const listFn = useServerFn(agentListMyAssignments);
  const updateFn = useServerFn(agentUpdateAssignment);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["agent", "assignments"], queryFn: () => listFn() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["agent", "assignments"] });
  const mut = useMutation({
    mutationFn: (v: { assignment_id: string; action: "pickup" | "deliver" | "fail"; otp?: string; reason?: string }) =>
      updateFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="container-page flex-1 py-16 text-muted-foreground">Loading…</main>
      </div>
    );
  }
  if (!data?.agent) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="container-page flex-1 py-16">
          <div className="max-w-md rounded-2xl border border-border bg-surface p-8">
            <h1 className="font-display text-2xl font-semibold">Apply to deliver</h1>
            <p className="mt-2 text-sm text-muted-foreground">You're not an approved delivery agent yet.</p>
            <Link to="/delivery/register" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
              Start application
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const assignments = data.assignments;
  const active = assignments.filter((a: any) => a.status === "assigned" || a.status === "picked_up");
  const done = assignments.filter((a: any) => a.status === "delivered");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Delivering for</p>
          <h1 className="font-display text-3xl font-semibold">{(data.agent as any).sellers?.kitchen_name}</h1>
        </div>
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Stat label="Active" value={active.length} icon={Truck} />
          <Stat label="Completed" value={done.length} icon={CheckCircle2} />
          <Stat label="Total" value={assignments.length} icon={Package} />
        </div>

        <h2 className="font-display text-xl font-semibold">Active deliveries</h2>
        <div className="mt-3 grid gap-3">
          {active.length === 0 && <p className="text-sm text-muted-foreground">Nothing to deliver right now.</p>}
          {active.map((a: any) => (
            <AssignmentCard key={a.id} a={a} onAction={mut.mutate} pending={mut.isPending} />
          ))}
        </div>

        <h2 className="mt-8 font-display text-xl font-semibold">Recent</h2>
        <div className="mt-3 grid gap-3">
          {done.slice(0, 10).map((a: any) => (
            <div key={a.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{a.orders?.order_number ?? `Subscription · ${a.subscription_deliveries?.scheduled_date}`}</span>
                <span className="text-success">Delivered</span>
              </div>
              <p className="text-xs text-muted-foreground">{new Date(a.delivered_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: any) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function AssignmentCard({ a, onAction, pending }: { a: any; onAction: (v: any) => void; pending: boolean }) {
  const [otp, setOtp] = useState("");
  const addr = (a.orders?.delivery_address ?? {}) as Record<string, string>;
  const isOrder = !!a.order_id;
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {isOrder ? a.orders?.order_number : `Subscription delivery · ${a.subscription_deliveries?.scheduled_date}`}
          </p>
          {isOrder && <p className="text-sm text-muted-foreground">{inr(Number(a.orders?.total ?? 0))}</p>}
        </div>
        <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning capitalize">{a.status.replace("_", " ")}</span>
      </div>
      {isOrder && addr.addressLine && (
        <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4" /> {addr.addressLine}, {addr.city} {addr.pincode}
        </p>
      )}
      {addr.phone && (
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4" /> <a href={`tel:${addr.phone}`} className="hover:underline">{addr.phone}</a>
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {a.status === "assigned" && (
          <button disabled={pending} onClick={() => onAction({ assignment_id: a.id, action: "pickup" })}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
            Mark picked up
          </button>
        )}
        {a.status === "picked_up" && (
          <>
            <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              <input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={4} placeholder="OTP"
                className="w-16 bg-transparent text-xs outline-none" />
            </div>
            <button disabled={pending || otp.length !== 4} onClick={() => onAction({ assignment_id: a.id, action: "deliver", otp })}
              className="rounded-full bg-success px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
              Confirm delivery
            </button>
          </>
        )}
        <button disabled={pending} onClick={() => {
          const reason = prompt("Reason for failure?") || "";
          if (reason) onAction({ assignment_id: a.id, action: "fail", reason });
        }}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-destructive">
          Failed
        </button>
      </div>
    </div>
  );
}
