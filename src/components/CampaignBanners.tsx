import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Clock } from "lucide-react";
import { listActiveCampaigns } from "@/lib/campaigns.functions";

function timeLeft(ends: string | null) {
  if (!ends) return null;
  const ms = new Date(ends).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  return `${h}h ${m}m left`;
}

export function CampaignBanners({ limit = 4 }: { limit?: number }) {
  const fn = useServerFn(listActiveCampaigns);
  const { data } = useQuery({ queryKey: ["campaigns", "active"], queryFn: () => fn(), staleTime: 60_000 });
  const items = (data ?? []).slice(0, limit);
  if (items.length === 0) return null;

  return (
    <section className="container-page py-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Today's offers</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((c: any) => {
          const tl = timeLeft(c.ends_at);
          return (
            <div key={c.id}
              className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-surface to-surface p-4 hover:shadow-soft transition-shadow">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold">
                  {c.type.replace("_", " ")}
                </span>
                {tl && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />{tl}
                  </span>
                )}
              </div>
              <div className="mt-2 font-display text-lg font-semibold leading-tight">{c.name}</div>
              {c.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
              <div className="mt-3 text-sm font-semibold text-primary">
                {c.discount_type === "percent" && `${c.discount_value}% off`}
                {c.discount_type === "flat" && `₹${c.discount_value} off`}
                {c.discount_type === "free_delivery" && "Free delivery"}
                {c.discount_type === "combo_price" && `Combo at ₹${c.discount_value}`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}