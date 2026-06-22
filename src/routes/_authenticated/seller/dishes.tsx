import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, X, Upload } from "lucide-react";
import {
  listSellerDishes,
  upsertDish,
  deleteDish,
  getDishUploadInfo,
} from "@/lib/seller.functions";
import { categoriesQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seller/dishes")({
  component: SellerDishes,
});

type Form = {
  id?: string;
  name: string;
  description: string;
  ingredients: string;
  price: string;
  prepTimeMin: string;
  stock: string;
  isVeg: boolean;
  isAvailable: boolean;
  categoryId: string;
  imagePath: string;
  imagePreview: string;
  badge: "" | "best_seller" | "chef_special" | "recommended" | "new";
  isFeatured: boolean;
};

const empty: Form = {
  name: "", description: "", ingredients: "", price: "", prepTimeMin: "30",
  stock: "20", isVeg: true, isAvailable: true, categoryId: "", imagePath: "", imagePreview: "",
  badge: "", isFeatured: false,
};

function SellerDishes() {
  const listFn = useServerFn(listSellerDishes);
  const saveFn = useServerFn(upsertDish);
  const delFn = useServerFn(deleteDish);
  const infoFn = useServerFn(getDishUploadInfo);
  const qc = useQueryClient();
  const { data: dishes = [], isLoading } = useQuery({ queryKey: ["seller", "dishes"], queryFn: () => listFn() });
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [editing, setEditing] = useState<Form | null>(null);
  const [uploading, setUploading] = useState(false);

  const saveMut = useMutation({
    mutationFn: (f: Form) =>
      saveFn({
        data: {
          id: f.id,
          data: {
            name: f.name, description: f.description, ingredients: f.ingredients,
            price: Number(f.price), prepTimeMin: Number(f.prepTimeMin), stock: Number(f.stock),
            isVeg: f.isVeg, isAvailable: f.isAvailable, categoryId: f.categoryId,
            imagePath: f.imagePath,
            badge: f.badge || null,
            isFeatured: f.isFeatured,
          },
        },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["seller", "dishes"] }); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seller", "dishes"] }),
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const info = await infoFn();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${info.sellerId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("dish-images").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("dish-images").createSignedUrl(path, 60 * 60);
      setEditing((prev) => prev ? { ...prev, imagePath: path, imagePreview: signed?.signedUrl ?? "" } : prev);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing({ ...empty })}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add dish
        </button>
      </div>
      <div className="rounded-xl border border-border bg-surface">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : dishes.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No dishes yet. Add your first one.</p>
        ) : (
          <div className="divide-y divide-border">
            {dishes.map((d: any) => (
              <div key={d.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {d.image_url && <img src={d.image_url} alt={d.name} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {inr(Number(d.price))} · {d.is_veg ? "Veg" : "Non-veg"} · Stock: {d.stock} ·{" "}
                    {d.is_available ? "Available" : "Hidden"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setEditing({
                        id: d.id, name: d.name, description: d.description ?? "",
                        ingredients: d.ingredients ?? "", price: String(d.price),
                        prepTimeMin: String(d.prep_time_min), stock: String(d.stock),
                        isVeg: d.is_veg, isAvailable: d.is_available,
                        categoryId: d.category_id ?? "", imagePath: "", imagePreview: d.image_url ?? "",
                        badge: (d.badge ?? "") as Form["badge"], isFeatured: !!d.is_featured,
                      })
                    }
                    className="rounded-md p-2 hover:bg-muted"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => confirm(`Delete ${d.name}?`) && delMut.mutate(d.id)}
                    className="rounded-md p-2 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={(e: FormEvent) => { e.preventDefault(); saveMut.mutate(editing); }}
            className="my-8 w-full max-w-lg rounded-2xl border border-border bg-card p-6 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">{editing.id ? "Edit dish" : "New dish"}</h2>
              <button type="button" onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                {editing.imagePreview && <img src={editing.imagePreview} alt="" className="h-full w-full object-cover" />}
              </div>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload image"}
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              </label>
            </div>

            <Field label="Name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} required />
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm" rows={2} maxLength={800} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Ingredients</span>
              <textarea value={editing.ingredients} onChange={(e) => setEditing({ ...editing, ingredients: e.target.value })}
                className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm" rows={2} maxLength={800} />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Price ₹" value={editing.price} onChange={(v) => setEditing({ ...editing, price: v })} required type="number" />
              <Field label="Prep (min)" value={editing.prepTimeMin} onChange={(v) => setEditing({ ...editing, prepTimeMin: v })} required type="number" />
              <Field label="Stock" value={editing.stock} onChange={(v) => setEditing({ ...editing, stock: v })} required type="number" />
            </div>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Category</span>
              <select value={editing.categoryId} onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">— None —</option>
                {(cats as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editing.isVeg} onChange={(e) => setEditing({ ...editing, isVeg: e.target.checked })} /> Veg
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editing.isAvailable} onChange={(e) => setEditing({ ...editing, isAvailable: e.target.checked })} /> Available
              </label>
            </div>
            <button type="submit" disabled={saveMut.isPending || uploading}
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saveMut.isPending ? "Saving…" : "Save dish"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}{required && " *"}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-ring" />
    </label>
  );
}
