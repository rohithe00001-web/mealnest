import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { spinWheel, getActiveWheel } from "@/lib/gamification.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SpinWheel({ alreadySpun }: { alreadySpun?: { prize_kind: string; prize_value: number; coupon_code: string | null } | null }) {
  const qc = useQueryClient();
  const spinFn = useServerFn(spinWheel);
  const fetchWheel = useServerFn(getActiveWheel);
  const { data, isLoading } = useQuery({ queryKey: ["active-wheel"], queryFn: () => fetchWheel() });
  const segments = (data?.segments ?? []) as any[];
  const segAngle = segments.length > 0 ? 360 / segments.length : 0;

  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ label: string; code: string | null; kind: string } | null>(null);

  const m = useMutation({
    mutationFn: () => spinFn(),
    onSuccess: (r) => {
      const idx = Math.max(0, segments.findIndex((s) => s.id === (r as any).segmentId || s.label === r.segmentLabel));
      const target = -(idx * segAngle + segAngle / 2) - 720 * 3;
      setRotation(target);
      setTimeout(() => {
        setResult({ label: r.segmentLabel ?? r.prizeKind, code: r.couponCode, kind: r.prizeKind });
        qc.invalidateQueries({ queryKey: ["gamification"] });
        qc.invalidateQueries({ queryKey: ["loyalty"] });
        if (r.prizeKind === "better_luck") toast("Better luck next time!");
        else toast.success(`You won ${r.segmentLabel}${r.couponCode ? ` — ${r.couponCode}` : ""}!`);
      }, 3200);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bg = useMemo(() =>
    segments.length === 0
      ? "#94a3b8"
      : segments.map((s, i) => `${s.color} ${i * segAngle}deg ${(i + 1) * segAngle}deg`).join(", "),
    [segments, segAngle]
  );

  if (isLoading) {
    return <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">Loading wheel…</div>;
  }
  if (!data?.wheel || segments.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-2"><Sparkles className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Daily Spin & Win</h2></div>
        <p className="text-sm text-muted-foreground">No active wheel right now. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">{(data.wheel as any).name}</h2>
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-64 h-64">
          <div
            className="absolute inset-0 rounded-full border-4 border-border shadow-soft transition-transform duration-[3000ms] ease-out"
            style={{ background: `conic-gradient(${bg})`, transform: `rotate(${rotation}deg)` }}
          >
            {segments.map((s, i) => {
              const a = i * segAngle + segAngle / 2;
              return (
                <div key={s.id}
                  className="absolute top-1/2 left-1/2 text-[11px] font-semibold text-white drop-shadow"
                  style={{
                    transform: `rotate(${a}deg) translateY(-90px) rotate(${-a}deg) translateX(-50%)`,
                    width: "80px", textAlign: "center",
                  }}>
                  {s.label}
                </div>
              );
            })}
          </div>
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-foreground" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center w-16 h-16 rounded-full bg-background border-4 border-border font-display font-bold">
            SPIN
          </div>
        </div>

        <Button size="lg" disabled={!!alreadySpun || m.isPending} onClick={() => m.mutate()}>
          {alreadySpun ? "Come back soon" : m.isPending ? "Spinning…" : "Spin the wheel"}
        </Button>

        {result && (
          <div className="text-center text-sm">
            <div className="text-muted-foreground">Your prize</div>
            <div className="font-semibold mt-1">
              {result.label}{result.code ? ` — code ${result.code}` : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
