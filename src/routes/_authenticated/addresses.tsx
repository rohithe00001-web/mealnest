import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Plus, Trash2, Star, Pencil, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { listAddresses, upsertAddress, deleteAddress } from "@/lib/customer.functions";
import { AddressPicker } from "@/components/AddressPicker";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/addresses")({
  component: AddressesPage,
});

const empty = { label: "Home", addressLine: "", city: "", pincode: "", isDefault: false, lat: null as number | null, lng: null as number | null };

function AddressesPage() {
  const listFn = useServerFn(listAddresses);
  const saveFn = useServerFn(upsertAddress);
  const delFn = useServerFn(deleteAddress);
  const qc = useQueryClient();
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => listFn(),
  });
  const [editing, setEditing] = useState<{ id?: string; form: typeof empty } | null>(null);

  const saveMut = useMutation({
    mutationFn: (v: { id?: string; data: typeof empty }) => saveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      setEditing(null);
      toast.success("Address saved");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Addresses</h1>
          <button
            onClick={() => setEditing({ form: { ...empty } })}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add address
          </button>
        </div>

        {isLoading ? (
          <p className="mt-8 text-muted-foreground">Loading…</p>
        ) : addresses.length === 0 && !editing ? (
          <p className="mt-10 rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            No saved addresses yet.
          </p>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {addresses.map((a: any) => (
              <li key={a.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      {a.label}
                      {a.is_default && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">
                          <Star className="h-3 w-3 fill-current" /> Default
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{a.address_line}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.city}
                      {a.pincode ? ` · ${a.pincode}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        setEditing({
                          id: a.id,
                          form: {
                            label: a.label,
                            addressLine: a.address_line,
                            city: a.city,
                            pincode: a.pincode ?? "",
                            isDefault: a.is_default,
                            lat: a.latitude != null ? Number(a.latitude) : null,
                            lng: a.longitude != null ? Number(a.longitude) : null,
                          },
                        })
                      }
                      className="rounded-md p-2 hover:bg-muted"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => delMut.mutate(a.id)}
                      className="rounded-md p-2 text-destructive hover:bg-destructive/10"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {editing && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm p-4 overflow-y-auto">
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                saveMut.mutate({ id: editing.id, data: editing.form });
              }}
              className="my-8 w-full max-w-lg rounded-2xl border border-border bg-card p-6 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">
                  {editing.id ? "Edit address" : "New address"}
                </h2>
                <button type="button" onClick={() => setEditing(null)} aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <AddressPicker
                value={{ lat: editing.form.lat, lng: editing.form.lng }}
                onChange={(p) =>
                  setEditing({
                    ...editing,
                    form: {
                      ...editing.form,
                      lat: p.lat,
                      lng: p.lng,
                      addressLine: editing.form.addressLine || p.addressLine,
                      city: editing.form.city || p.city,
                      pincode: editing.form.pincode || p.pincode,
                    },
                  })
                }
              />
              <Field label="Label" value={editing.form.label} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, label: v } })} />
              <Field label="Address" value={editing.form.addressLine} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, addressLine: v } })} required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="City" value={editing.form.city} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, city: v } })} required />
                <Field label="Pincode" value={editing.form.pincode} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, pincode: v } })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.form.isDefault}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, isDefault: e.target.checked } })}
                />
                Make this my default address
              </label>
              <button
                type="submit"
                disabled={saveMut.isPending}
                className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saveMut.isPending ? "Saving…" : "Save"}
              </button>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && " *"}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-ring"
      />
    </label>
  );
}
