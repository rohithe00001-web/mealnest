import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Smartphone, ShieldCheck, Trash2, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listMyDevices, removeMyDeviceLink, startDeviceTransfer, confirmDeviceTransfer } from "@/lib/devices.functions";
import { getCachedDeviceId, getDeviceFingerprint } from "@/lib/device";

export const Route = createFileRoute("/_authenticated/devices")({
  component: MyDevicesPage,
  head: () => ({ meta: [{ title: "Trusted devices — MealNest" }, { name: "robots", content: "noindex" }] }),
});

function MyDevicesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMyDevices);
  const remove = useServerFn(removeMyDeviceLink);
  const startTx = useServerFn(startDeviceTransfer);
  const confirmTx = useServerFn(confirmDeviceTransfer);

  const { data, isLoading } = useQuery({ queryKey: ["my-devices"], queryFn: () => list() });
  const currentId = getCachedDeviceId();
  const [transferOpen, setTransferOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [issuedOtp, setIssuedOtp] = useState<string | null>(null);

  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Device removed"); qc.invalidateQueries({ queryKey: ["my-devices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  async function onStartTransfer() {
    const fp = await getDeviceFingerprint();
    const res = await startTx({ data: { fingerprint: fp } });
    setIssuedOtp(res.otp);
    toast.success("Verification code generated. Enter it below to complete transfer.");
  }
  async function onConfirmTransfer() {
    const fp = await getDeviceFingerprint();
    const res = await confirmTx({ data: { fingerprint: fp, otp } });
    if (res.ok) {
      toast.success("Device transferred");
      setTransferOpen(false);
      setOtp(""); setIssuedOtp(null);
      qc.invalidateQueries({ queryKey: ["my-devices"] });
    } else {
      toast.error("Invalid or expired code");
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold">Trusted devices</h1>
            <p className="text-sm text-muted-foreground">Devices linked to your MealNest account.</p>
          </div>
          <Button variant="outline" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="mr-1 h-4 w-4" /> Transfer to this device
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {(data ?? []).map((d: any) => {
            const dev = d.device;
            const isCurrent = dev?.id === currentId;
            return (
              <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted">
                      <Smartphone className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {dev?.name || dev?.platform || "Unknown device"}
                        {isCurrent && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"><ShieldCheck className="h-3 w-3"/>This device</span>}
                        {d.is_primary && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">Primary</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 break-all">
                        {dev?.user_agent?.slice(0, 80)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Role: {d.role} · Risk: {dev?.risk_level ?? "low"} · Last seen: {dev?.last_seen_at ? new Date(dev.last_seen_at).toLocaleString() : "—"}
                      </div>
                    </div>
                  </div>
                  {!isCurrent && (
                    <Button size="sm" variant="ghost" onClick={() => removeM.mutate(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {!isLoading && (data ?? []).length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No devices linked yet.
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          MealNest enforces one primary account per device. If you replaced your phone or browser, use the transfer flow above. Device identification is best-effort and never replaces your password.
        </p>
      </main>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer account to this device</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Generate a 6-digit verification code and enter it below to move your account to this device.
            </p>
            <Button onClick={onStartTransfer}>Generate code</Button>
            {issuedOtp && (
              <div className="rounded-lg border border-border bg-muted p-3 text-center font-mono text-lg">
                {issuedOtp}
              </div>
            )}
            <div>
              <Label>Code</Label>
              <Input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} placeholder="123456" />
            </div>
            <Button onClick={onConfirmTransfer} className="w-full" disabled={otp.length !== 6}>
              Confirm transfer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
