import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import {
  registerDeliveryAgent,
  getMyDeliveryApplication,
  listApprovedSellers,
} from "@/lib/delivery.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  User, Bike, Banknote, ShieldCheck, ClipboardList, Search, Star,
  MapPin, CheckCircle2, Clock, XCircle, Upload, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/delivery/register")({
  head: () => ({
    meta: [
      { title: "Become a Delivery Partner — MealNest" },
      { name: "description", content: "Apply to deliver homemade meals with MealNest." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeliveryRegister,
});

type VehicleType = "Bike" | "Scooter" | "Bicycle" | "Electric Vehicle";
const VEHICLES: VehicleType[] = ["Bike", "Scooter", "Bicycle", "Electric Vehicle"];
const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOTS = ["Breakfast (7–10am)", "Lunch (11am–3pm)", "Snacks (4–6pm)", "Dinner (7–11pm)"];

const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  pending_seller: { label: "Pending Seller Approval", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400", icon: Clock },
  pending_admin: { label: "Seller Approved · Pending Admin", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-400", icon: Clock },
  approved: { label: "Approved — Active Delivery Partner", tone: "bg-success/15 text-success", icon: CheckCircle2 },
  rejected: { label: "Rejected", tone: "bg-destructive/15 text-destructive", icon: XCircle },
  suspended: { label: "Suspended", tone: "bg-muted text-muted-foreground", icon: XCircle },
};

function DeliveryRegister() {
  const { user } = useAuth();
  const sellersFn = useServerFn(listApprovedSellers);
  const meFn = useServerFn(getMyDeliveryApplication);
  const regFn = useServerFn(registerDeliveryAgent);
  const { data: sellers = [] } = useQuery({ queryKey: ["sellers", "approved", "agents"], queryFn: () => sellersFn() });
  const { data: applications = [], refetch } = useQuery({ queryKey: ["my-delivery-application"], queryFn: () => meFn() });

  const [step, setStep] = useState<"status" | "form">(applications.length === 0 ? "form" : "status");
  const [sellerSearch, setSellerSearch] = useState("");
  const initialName = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "";

  const [form, setForm] = useState<any>({
    seller_id: "",
    full_name: initialName, photo_url: "", date_of_birth: "", gender: "",
    phone: "", email: user?.email ?? "", residential_address: "",
    aadhaar_number: "", license_number: "", id_doc_url: "", license_doc_url: "",
    vehicle_type: "", vehicle_number: "", rc_doc_url: "", insurance_doc_url: "", vehicle_doc_url: "",
    bank_account_name: "", bank_name: "", bank_account_number: "", bank_ifsc: "", upi_id: "",
    preferred_areas: "", working_days: [] as string[], working_hours_start: "", working_hours_end: "",
    available_slots: [] as string[],
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggleArr = (k: string, v: string) =>
    setForm((f: any) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x: string) => x !== v) : [...f[k], v] }));

  const upload = async (key: string, file: File) => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;
    const path = `${u.id}/${key}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("agent-docs").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    set(key, path);
    toast.success("Uploaded");
  };

  const filteredSellers = useMemo(() => {
    const q = sellerSearch.trim().toLowerCase();
    if (!q) return sellers;
    return (sellers as any[]).filter((s) =>
      [s.kitchen_name, s.city, s.address_line].join(" ").toLowerCase().includes(q),
    );
  }, [sellers, sellerSearch]);

  const selectedSeller = (sellers as any[]).find((s) => s.id === form.seller_id);

  const mut = useMutation({
    mutationFn: () => {
      if (!form.seller_id) throw new Error("Please select a kitchen to apply to");
      const requireds = ["full_name", "phone", "date_of_birth", "gender", "residential_address",
        "aadhaar_number", "license_number", "vehicle_type", "vehicle_number",
        "bank_account_name", "bank_name", "bank_account_number", "bank_ifsc"];
      for (const k of requireds) if (!form[k]) throw new Error(`Missing: ${k.replace(/_/g, " ")}`);
      const docs = ["id_doc_url", "license_doc_url", "rc_doc_url"];
      for (const d of docs) if (!form[d]) throw new Error(`Please upload your ${d.replace("_doc_url", "").replace("id", "Aadhaar")}`);
      if (!form.working_days.length) throw new Error("Pick at least one working day");
      if (!form.available_slots.length) throw new Error("Pick at least one time slot");
      const payload = {
        ...form,
        preferred_areas: form.preferred_areas
          ? form.preferred_areas.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [],
      };
      return regFn({ data: payload });
    },
    onSuccess: () => { toast.success("Application submitted! Waiting for seller approval."); refetch(); setStep("status"); },
    onError: (e: any) => toast.error(e.message),
  });

  const latest = applications[0];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8 max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Become a Delivery Partner</h1>
            <p className="mt-1 text-sm text-muted-foreground">Earn flexibly while delivering home‑cooked meals.</p>
          </div>
          {applications.length > 0 && (
            <div className="flex gap-2 text-xs">
              <button onClick={() => setStep("status")}
                className={`rounded-full px-3 py-1.5 ${step === "status" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>Status</button>
              <button onClick={() => setStep("form")}
                className={`rounded-full px-3 py-1.5 ${step === "form" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>New application</button>
            </div>
          )}
        </div>

        {/* STATUS TRACKER */}
        {step === "status" && applications.length > 0 && (
          <section className="mt-6 space-y-4">
            {applications.map((a: any) => {
              const meta = STATUS_META[a.status] ?? { label: a.status, tone: "bg-muted", icon: Clock };
              const Icon = meta.icon;
              return (
                <div key={a.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Application</p>
                      <h3 className="font-display text-xl font-semibold">{a.full_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Kitchen: <span className="font-medium text-foreground">{a.sellers?.kitchen_name ?? "—"}</span>
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${meta.tone}`}>
                      <Icon className="h-3.5 w-3.5" /> {meta.label}
                    </span>
                  </div>

                  {/* Timeline */}
                  <ol className="mt-5 grid gap-2 sm:grid-cols-4 text-xs">
                    {[
                      { key: "submitted", label: "Submitted", done: true },
                      { key: "seller", label: "Seller review", done: ["pending_admin", "approved"].includes(a.status), reject: a.status === "rejected" && !!a.seller_rejected_reason },
                      { key: "admin", label: "Admin verification", done: a.status === "approved", reject: a.status === "rejected" && !!a.admin_rejected_reason },
                      { key: "active", label: "Active partner", done: a.status === "approved" },
                    ].map((s) => (
                      <li key={s.key}
                        className={`rounded-xl border p-3 ${
                          s.reject ? "border-destructive/40 bg-destructive/5" :
                          s.done ? "border-success/40 bg-success/5" : "border-border bg-surface"
                        }`}>
                        <span className="font-medium">{s.label}</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {s.reject ? "Rejected" : s.done ? "Done" : "Pending"}
                        </p>
                      </li>
                    ))}
                  </ol>

                  {(a.seller_rejected_reason || a.admin_rejected_reason || a.rejected_reason) && (
                    <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      <p className="font-medium">Reason for rejection</p>
                      <p className="mt-1 text-destructive/90">
                        {a.admin_rejected_reason || a.seller_rejected_reason || a.rejected_reason}
                      </p>
                    </div>
                  )}

                  {a.status === "approved" && (
                    <Link to="/delivery"
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                      Switch to Delivery Dashboard <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* FORM */}
        {step === "form" && (
          <form className="mt-8 space-y-8" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
            {/* Seller selection */}
            <Section icon={Search} title="Select a kitchen to apply to">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={sellerSearch} onChange={(e) => setSellerSearch(e.target.value)}
                  placeholder="Search by kitchen name, city or area…"
                  className="h-11 w-full rounded-full border border-border bg-surface pl-9 pr-4 text-sm" />
              </div>
              {selectedSeller && (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm">Selected: <strong>{selectedSeller.kitchen_name}</strong></span>
                </div>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {filteredSellers.slice(0, 20).map((s: any) => {
                  const active = s.id === form.seller_id;
                  return (
                    <button type="button" key={s.id} onClick={() => set("seller_id", s.id)}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                        active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                      }`}>
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-secondary">
                        {s.logo_url
                          ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" />
                          : <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">{s.kitchen_name?.[0]}</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.kitchen_name}</p>
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-primary text-primary" />{Number(s.rating_avg ?? 0).toFixed(1)}</span>
                          {s.city && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{s.city}</span>}
                        </p>
                      </div>
                    </button>
                  );
                })}
                {filteredSellers.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-full">No kitchens found.</p>
                )}
              </div>
            </Section>

            {/* Personal */}
            <Section icon={User} title="Personal information">
              <Grid>
                <Field label="Full name *" value={form.full_name} onChange={(v) => set("full_name", v)} />
                <FileField label="Profile photo" done={!!form.photo_url} onPick={(f) => upload("photo_url", f)} />
                <Field label="Date of birth *" type="date" value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)} />
                <SelectField label="Gender *" value={form.gender} onChange={(v) => set("gender", v)} options={GENDERS} />
                <Field label="Mobile number *" value={form.phone} onChange={(v) => set("phone", v)} />
                <Field label="Email" value={form.email} onChange={(v) => set("email", v)} />
                <Field label="Residential address *" value={form.residential_address} onChange={(v) => set("residential_address", v)} full />
              </Grid>
            </Section>

            {/* Identity */}
            <Section icon={ShieldCheck} title="Identity verification">
              <Grid>
                <Field label="Aadhaar number *" value={form.aadhaar_number} onChange={(v) => set("aadhaar_number", v)} />
                <FileField label="Aadhaar upload *" done={!!form.id_doc_url} onPick={(f) => upload("id_doc_url", f)} />
                <Field label="Driving license number *" value={form.license_number} onChange={(v) => set("license_number", v)} />
                <FileField label="Driving license upload *" done={!!form.license_doc_url} onPick={(f) => upload("license_doc_url", f)} />
              </Grid>
            </Section>

            {/* Vehicle */}
            <Section icon={Bike} title="Vehicle information">
              <div className="flex flex-wrap gap-2">
                {VEHICLES.map((v) => (
                  <button type="button" key={v} onClick={() => set("vehicle_type", v)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                      form.vehicle_type === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}>{v}</button>
                ))}
              </div>
              <Grid className="mt-4">
                <Field label="Vehicle registration number *" value={form.vehicle_number} onChange={(v) => set("vehicle_number", v)} />
                <FileField label="RC book upload *" done={!!form.rc_doc_url} onPick={(f) => upload("rc_doc_url", f)} />
                <FileField label="Vehicle insurance (optional)" done={!!form.insurance_doc_url} onPick={(f) => upload("insurance_doc_url", f)} />
              </Grid>
            </Section>

            {/* Banking */}
            <Section icon={Banknote} title="Banking details">
              <Grid>
                <Field label="Account holder name *" value={form.bank_account_name} onChange={(v) => set("bank_account_name", v)} />
                <Field label="Bank name *" value={form.bank_name} onChange={(v) => set("bank_name", v)} />
                <Field label="Account number *" value={form.bank_account_number} onChange={(v) => set("bank_account_number", v)} />
                <Field label="IFSC code *" value={form.bank_ifsc} onChange={(v) => set("bank_ifsc", v.toUpperCase())} />
                <Field label="UPI ID" value={form.upi_id} onChange={(v) => set("upi_id", v)} full />
              </Grid>
            </Section>

            {/* Preferences */}
            <Section icon={ClipboardList} title="Working preferences">
              <Field label="Preferred delivery areas (comma separated)" value={form.preferred_areas}
                onChange={(v) => set("preferred_areas", v)} full />
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground">Working days *</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <button type="button" key={d} onClick={() => toggleArr("working_days", d)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        form.working_days.includes(d) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                      }`}>{d}</button>
                  ))}
                </div>
              </div>
              <Grid className="mt-4">
                <Field label="Working hours start" type="time" value={form.working_hours_start} onChange={(v) => set("working_hours_start", v)} />
                <Field label="Working hours end" type="time" value={form.working_hours_end} onChange={(v) => set("working_hours_end", v)} />
              </Grid>
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground">Available time slots *</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SLOTS.map((s) => (
                    <button type="button" key={s} onClick={() => toggleArr("available_slots", s)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        form.available_slots.includes(s) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
            </Section>

            <div className="sticky bottom-20 sm:bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
              <p className="text-xs text-muted-foreground">
                By submitting you agree to verification by the selected kitchen and MealNest admins.
              </p>
              <button disabled={mut.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {mut.isPending ? "Submitting…" : "Submit application"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {latest && latest.status !== "approved" && (
              <p className="text-center text-xs text-muted-foreground">
                You have an existing application ({latest.status}). Submitting again will create a new one for another kitchen.
              </p>
            )}
          </form>
        )}
      </main>
    </div>
  );
}

function Section({ icon: Icon, title, children }: any) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Grid({ children, className = "" }: any) {
  return <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>{children}</div>;
}

function Field({ label, value, onChange, type = "text", full = false }: { label: string; value: any; onChange: (v: string) => void; type?: string; full?: boolean }) {
  return (
    <label className={`grid gap-1 text-sm ${full ? "sm:col-span-2" : ""}`}>
      <span className="font-medium">{label}</span>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg border border-border bg-surface px-3 outline-none focus:border-ring" />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: any) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg border border-border bg-surface px-3">
        <option value="">Select…</option>
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function FileField({ label, done, onPick }: { label: string; done: boolean; onPick: (f: File) => void }) {
  return (
    <label className={`flex h-11 cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 text-sm transition-colors ${
      done ? "border-success bg-success/5 text-success" : "border-dashed border-border bg-surface text-muted-foreground hover:border-primary/40"
    }`}>
      <span className="truncate">{label}</span>
      <span className="inline-flex items-center gap-1 text-xs">
        {done ? <><CheckCircle2 className="h-4 w-4" /> Uploaded</> : <><Upload className="h-3.5 w-3.5" /> Upload</>}
      </span>
      <input type="file" className="hidden" accept="image/*,application/pdf"
        onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
    </label>
  );
}
