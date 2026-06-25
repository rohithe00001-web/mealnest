import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getPaymentMode, setPaymentMode } from "@/lib/payment-mode.functions";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  const getFn = useServerFn(getPaymentMode);
  const setFn = useServerFn(setPaymentMode);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payment-mode"],
    queryFn: () => getFn(),
  });

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => setFn({ data: { enabled } }),
    onSuccess: (res) => {
      toast.success(`Online payments ${res.onlinePaymentsEnabled ? "enabled" : "disabled"}`);
      qc.invalidateQueries({ queryKey: ["admin", "payment-mode"] });
      qc.invalidateQueries({ queryKey: ["payment-mode"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update"),
  });

  const enabled = data?.onlinePaymentsEnabled ?? false;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-semibold">Payment management</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Control how customers pay across MealNest. Disabling online payments forces every checkout to Cash on Delivery.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-semibold">Online payments</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              UPI, cards, net banking, wallets and gateway integrations (Razorpay) are gated by this switch.
              Cash on Delivery is always available regardless of this setting.
            </p>

            <div className="mt-5 flex items-center gap-4">
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                disabled={isLoading || mutation.isPending}
                onClick={() => mutation.mutate(!enabled)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  enabled ? "bg-primary" : "bg-muted"
                } disabled:opacity-60`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <div className="text-sm">
                <p className="font-medium">
                  Status:{" "}
                  <span className={enabled ? "text-green-600" : "text-amber-600"}>
                    {isLoading ? "Loading…" : enabled ? "Enabled" : "Disabled"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {enabled
                    ? "All configured gateways are live. Customers can choose any saved payment method."
                    : "Only Cash on Delivery is shown at checkout. Gateway code remains in place for instant re-enable."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          The payment-gateway schema, secrets and webhook handlers are preserved. Toggling this on re-activates
          every configured method instantly — no migration or deploy needed.
        </p>
      </div>
    </div>
  );
}
