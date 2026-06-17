import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { spinWheel } from "@/lib/gamification.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SEGMENTS = [
  { label: "50 coins", color: "#fb923c" },
  { label: "100 coins", color: "#f59e0b" },
  { label: "₹50 coupon", color: "#10b981" },
  { label: "₹100 coupon", color: "#06b6d4" },
  { label: "Free delivery", color: "#8b5cf6" },
  { label: "Try again", color: "#94a3b8" },
];
const SEG_ANGLE = 360 / SEGMENTS.length;

function prizeIndex(kind: string, value: number) {
  if (kind === "coins" && value === 50) return 0;
  if (kind === "coins" && value === 100) return 1;
  if (kind === "coupon" && value === 50) return 2;
  if (kind === "coupon" && value === 100) return 3;
  if (kind === "free_delivery") return 4;
  return 5;
}

export function SpinWheel({ alreadySpun }: { alreadySpun?: { prize_kind: string; prize_value: number; coupon_code: string | null } | null }) {
  const qc = useQueryClient();
  const spinFn = useServerFn(spinWheel);
  const [rotation, setRotation] = useState<number>(
    alreadySpun ? -(prizeIndex(alreadySpun.prize_kind, alreadySpun.prize_value) * SEG_ANGLE + SEG_ANGLE / 2) - 720 : 0
  );
  const [result, setResult] = useState<{ kind: string; value: number; code: string | null } | null>(
    alreadySpun ? { kind: alreadySpun.prize_kind, value: alreadySpun.prize_value, code: alreadySpun.coupon_code } : null
  );

  const m = useMutation({
    mutationFn: () => spinFn(),
    onSuccess: (r) => {
      const idx = prizeIndex(r.prizeKind, r.prizeValue);
      const target = -(idx * SEG_ANGLE + SEG_ANGLE / 2) - 720 * 3;
      setRotation(target);
      setTimeout(() => {
        setResult({ kind: r.prizeKind, value: r.prizeValue, code: r.couponCode });
        qc.invalidateQueries({ queryKey: ["gamification"] });
        qc.invalidateQueries({ queryKey: ["loyalty"] });
        if (r.prizeKind === "better_luck") toast("Better luck tomorrow!");
        else toast.success(`You won ${SEGMENTS[idx].label}${r.couponCode ? ` (${r.couponCode})` : ""}!`);
      }, 3200);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Build conic-gradient bg
  const bg = SEGMENTS.map((s, i) =>
    `${s.color} ${i * SEG_ANGLE}deg ${(i + 1) * SEG_ANGLE}deg`
  ).join(", ");

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Daily Spin & Win</h2>
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-64 h-64">
          <div
            className="absolute inset-0 rounded-full border-4 border-border shadow-soft transition-transform duration-[3000ms] ease-out"
            style={{
              background: `conic-gradient(${bg})`,
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {SEGMENTS.map((s, i) => {
              const a = i * SEG_ANGLE + SEG_ANGLE / 2;
              return (
                <div key={i}
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
          {/* Pointer */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-foreground" />
          {/* Center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center w-16 h-16 rounded-full bg-background border-4 border-border font-display font-bold">
            SPIN
          </div>
        </div>

        <Button
          size="lg"
          disabled={!!alreadySpun || m.isPending}
          onClick={() => m.mutate()}
        >
          {alreadySpun ? "Come back tomorrow" : m.isPending ? "Spinning…" : "Spin the wheel"}
        </Button>

        {result && (
          <div className="text-center text-sm">
            <div className="text-muted-foreground">Today's prize</div>
            <div className="font-semibold mt-1">
              {result.kind === "better_luck"
                ? "Better luck tomorrow"
                : result.kind === "coins" ? `${result.value} coins added`
                : result.kind === "free_delivery" ? `Free delivery — code ${result.code}`
                : `₹${result.value} off — code ${result.code}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}