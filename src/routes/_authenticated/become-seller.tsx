import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChefHat } from "lucide-react";

export const Route = createFileRoute("/_authenticated/become-seller")({
  component: BecomeSellerPage,
});

function BecomeSellerPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    kitchen_name: "", description: "", phone: "", email: "",
    address_line: "", city: "", pincode: "",
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("sellers").insert({
        user_id: u.user.id,
        kitchen_name: form.kitchen_name,
        description: form.description || null,
        phone: form.phone,
        email: form.email || u.user.email,
        address_line: form.address_line,
        city: form.city,
        pincode: form.pincode || null,
      });
      if (error) throw error;
      // Add seller role
      await supabase.from("user_roles").insert({ user_id: u.user.id, role: "seller" }).then(() => {});
      toast.success("Application submitted! We'll review your kitchen shortly.");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Could not submit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />
      <main className="container-page flex-1 py-12">
        <div className="mx-auto max-w-2xl">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><ChefHat className="h-6 w-6" /></span>
          <h1 className="mt-4 font-display text-4xl font-semibold">Open your home kitchen</h1>
          <p className="mt-2 text-muted-foreground">Tell us about your kitchen. Our team reviews every application before approval.</p>

          <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
            <Field label="Kitchen name" value={form.kitchen_name} onChange={(v) => setForm({ ...form, kitchen_name: v })} required />
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-ring" placeholder="What kind of food do you cook?" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
              <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
            </div>
            <Field label="Address" value={form.address_line} onChange={(v) => setForm({ ...form, address_line: v })} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
              <Field label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} />
            </div>
            <p className="text-xs text-muted-foreground">Document upload (FSSAI license, ID proof) becomes available after initial approval.</p>
            <button type="submit" disabled={loading} className="inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? "Submitting…" : "Submit application"}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Field({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}{required && " *"}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-ring" />
    </label>
  );
}
