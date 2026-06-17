import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAbuseReports, markAbuseReviewed } from "@/lib/abuse.functions";
import { ShieldAlert, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/abuse")({
  component: AbuseReportsPage,
});

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

function AbuseReportsPage() {
  const fetchReports = useServerFn(listAbuseReports);
  const markReviewed = useServerFn(markAbuseReviewed);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "abuse-reports"],
    queryFn: () => fetchReports(),
  });
  const reviewMut = useMutation({
    mutationFn: (id: string) => markReviewed({ data: { id } }),
    onSuccess: () => {
      toast.success("Marked reviewed");
      qc.invalidateQueries({ queryKey: ["admin", "abuse-reports"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const reports = data?.reports ?? [];
  const unreviewed = reports.filter((r: any) => !r.reviewed).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            Abuse reports
          </h2>
          <p className="text-sm text-muted-foreground">
            Suspicious reward activity flagged by the system. {unreviewed} pending review.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          No abuse reports — system is clean.
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r: any) => (
            <div
              key={r.id}
              className={`rounded-xl border bg-surface p-4 ${
                r.reviewed ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        SEVERITY_STYLES[r.severity] ?? SEVERITY_STYLES.low
                      }`}
                    >
                      {r.severity}
                    </span>
                    <span className="font-mono text-sm font-semibold">{r.kind}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    User: <span className="font-mono">{r.user_id ?? "—"}</span>
                  </p>
                  {r.details && Object.keys(r.details).length > 0 && (
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-2 text-xs">
                      {JSON.stringify(r.details, null, 2)}
                    </pre>
                  )}
                </div>
                {!r.reviewed && (
                  <button
                    onClick={() => reviewMut.mutate(r.id)}
                    disabled={reviewMut.isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <Check className="h-3.5 w-3.5" /> Reviewed
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}