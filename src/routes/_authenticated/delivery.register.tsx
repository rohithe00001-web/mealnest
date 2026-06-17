import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { registerDeliveryAgent, getMyAgentProfile, listApprovedSellers } from "@/lib/delivery.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/delivery/register")({
  component: DeliveryRegister,
});

function DeliveryRegister() {
  const sellersFn = useServerFn(listApprovedSellers);
  const meFn = useServerFn(getMyAgentProfile);
  const regFn = useServerFn(registerDeliveryAgent);
  const { data: sellers = [] } = useQuery({ queryKey: ["sellers", "approved"], queryFn: () => sellersFn() });
  const { data: me = [], refetch } = useQuery({ queryKey: ["agent", "me"], queryFn: () => meFn() });

  const [form, setForm] = useState({
    seller_id: "", full_name: "", phone: "", email: "",
    vehicle_type: "", vehicle_number: "", aadhaar_number: "", license_number: "",
    id_doc_url: "", license_doc_url: "", vehicle_doc_url: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const upload = async (key: "id_doc_url" | "license_doc_url" | "vehicle_doc_url", file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/${key}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("agent-docs").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    set(key, path);
    toast.success("Uploaded");
  };

  const mut = useMutation({
    mutationFn: () => regFn({ data: form as any }),
    onSuccess: () => { toast.success("Submitted! Waiting for seller approval."); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-10 max-w-3xl">
        <h1 className="font-display text-3xl font-semibold">Become a delivery agent</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a kitchen, upload your docs, and wait for seller + admin approval.
        </p>

        {me.length > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-surface p-4">
            <h2 className="font-medium">Your applications</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {me.map((a: any) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span>{a.sellers?.kitchen_name ?? "—"}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{a.status}</span>
                </li>
              ))}
            </ul>
            {me.some((a: any) => a.status === "approved") && (
              <Link to="/delivery" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                Go to agent dashboard →
              </Link>
            )}
          </div>
        )}

        <form
          className="mt-8 grid gap-4"
          onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
        >
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Kitchen</span>
            <select required value={form.seller_id} onChange={(e) => set("seller_id", e.target.value)}
              className="h-11 rounded-lg border border-border bg-surface px-3">
              <option value="">Select a kitchen…</option>
              {sellers.map((s: any) => <option key={s.id} value={s.id}>{s.kitchen_name} — {s.city}</option>)}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" value={form.full_name} onChange={(v) => set("full_name", v)} required />
            <Input label="Phone" value={form.phone} onChange={(v) => set("phone", v)} required />
            <Input label="Email" value={form.email} onChange={(v) => set("email", v)} />
            <Input label="Vehicle type" value={form.vehicle_type} onChange={(v) => set("vehicle_type", v)} placeholder="Bike / Scooter / Cycle" />
            <Input label="Vehicle number" value={form.vehicle_number} onChange={(v) => set("vehicle_number", v)} />
            <Input label="Aadhaar number" value={form.aadhaar_number} onChange={(v) => set("aadhaar_number", v)} />
            <Input label="License number" value={form.license_number} onChange={(v) => set("license_number", v)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <FileField label="ID proof" done={!!form.id_doc_url} onPick={(f) => upload("id_doc_url", f)} />
            <FileField label="License" done={!!form.license_doc_url} onPick={(f) => upload("license_doc_url", f)} />
            <FileField label="Vehicle RC" done={!!form.vehicle_doc_url} onPick={(f) => upload("vehicle_doc_url", f)} />
          </div>
          <button disabled={mut.isPending} className="h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {mut.isPending ? "Submitting…" : "Submit application"}
          </button>
        </form>
      </main>
    </div>
  );
}

function Input({ label, value, onChange, required, placeholder }: any) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input required={required} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg border border-border bg-surface px-3" />
    </label>
  );
}

function FileField({ label, done, onPick }: { label: string; done: boolean; onPick: (f: File) => void }) {
  return (
    <label className={`flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 text-center text-xs ${done ? "border-success text-success" : "border-border text-muted-foreground"}`}>
      <span className="font-medium">{label}</span>
      <span className="mt-1">{done ? "Uploaded ✓" : "Click to upload"}</span>
      <input type="file" className="hidden" accept="image/*,application/pdf"
        onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
    </label>
  );
}
