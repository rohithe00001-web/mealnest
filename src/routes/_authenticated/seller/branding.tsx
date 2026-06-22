import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { getSellerMe, getSellerBrandingUploadInfo, updateSellerBranding } from "@/lib/seller.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seller/branding")({
  component: BrandingPage,
});

type ImgUpload = { path: string; url: string };

function BrandingPage() {
  const meFn = useServerFn(getSellerMe);
  const infoFn = useServerFn(getSellerBrandingUploadInfo);
  const saveFn = useServerFn(updateSellerBranding);
  const qc = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["seller", "me"], queryFn: () => meFn() });
  const { data: info } = useQuery({ queryKey: ["seller", "branding-info"], queryFn: () => infoFn(), enabled: !!me });

  const [logo, setLogo] = useState<ImgUpload | null>(null);
  const [banner, setBanner] = useState<ImgUpload | null>(null);
  const [gallery, setGallery] = useState<ImgUpload[]>([]);
  const [description, setDescription] = useState("");
  const [story, setStory] = useState("");
  const [cuisines, setCuisines] = useState("");
  const [specialties, setSpecialties] = useState("");

  useEffect(() => {
    if (!me) return;
    setDescription((me as any).description ?? "");
    setStory((me as any).story ?? "");
    setCuisines(((me as any).cuisines ?? []).join(", "));
    setSpecialties(((me as any).specialties ?? []).join(", "));
    if ((me as any).logo_url) setLogo({ path: "", url: (me as any).logo_url });
    if ((me as any).banner_url) setBanner({ path: "", url: (me as any).banner_url });
    const g = (me as any).gallery;
    if (Array.isArray(g)) setGallery(g.map((url: string) => ({ path: "", url })));
  }, [me]);

  async function uploadFile(file: File, prefix: string): Promise<ImgUpload> {
    if (!info) throw new Error("Not ready");
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${info.sellerId}/${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(info.bucket).upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = await supabase.storage
      .from(info.bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    return { path, url: data?.signedUrl ?? "" };
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      // Only send paths for newly-uploaded files (path !== "")
      const payload: any = {
        description,
        story,
        cuisines: cuisines.split(",").map((s) => s.trim()).filter(Boolean),
        specialties: specialties.split(",").map((s) => s.trim()).filter(Boolean),
      };
      if (logo?.path) payload.logoPath = logo.path;
      if (banner?.path) payload.bannerPath = banner.path;
      const newGalleryPaths = gallery.filter((g) => g.path).map((g) => g.path);
      // If any new uploads OR the user removed images, resend the full list
      const originalGallery = ((me as any)?.gallery ?? []) as string[];
      if (newGalleryPaths.length || gallery.length !== originalGallery.length) {
        // Re-derive paths by parsing seller-branding paths from existing signed URLs
        const existingPaths = gallery
          .filter((g) => !g.path && g.url)
          .map((g) => extractPath(g.url, info?.bucket ?? "seller-branding"))
          .filter(Boolean) as string[];
        payload.galleryPaths = [...existingPaths, ...newGalleryPaths];
      }
      return saveFn({ data: payload });
    },
    onSuccess: () => {
      toast.success("Storefront updated");
      qc.invalidateQueries({ queryKey: ["seller"] });
      qc.invalidateQueries({ queryKey: ["sellers"] });
      qc.invalidateQueries({ queryKey: ["seller-store"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        saveMut.mutate();
      }}
      className="space-y-6"
    >
      <div>
        <h2 className="font-display text-2xl font-semibold">Storefront branding</h2>
        <p className="text-sm text-muted-foreground">
          Make your kitchen stand out. Customers see this on the marketplace and your store page.
        </p>
      </div>

      <Card title="Banner image" hint="Recommended 1600×900 — kitchen photo or hero food shot">
        <ImageDrop
          value={banner}
          onUpload={async (f) => setBanner(await uploadFile(f, "banner"))}
          onClear={() => setBanner(null)}
          aspect="aspect-[16/9]"
        />
      </Card>

      <Card title="Store logo" hint="Square PNG/JPG/SVG, 512×512 looks best">
        <div className="max-w-[200px]">
          <ImageDrop
            value={logo}
            onUpload={async (f) => setLogo(await uploadFile(f, "logo"))}
            onClear={() => setLogo(null)}
            aspect="aspect-square"
          />
        </div>
      </Card>

      <Card title="Short description" hint="One or two lines shown on cards and headers">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={500}
          className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-ring"
          placeholder="Authentic South-Indian breakfasts cooked fresh every morning."
        />
      </Card>

      <Card title="Story" hint="Tell customers who you are, your inspiration, and what makes you special">
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={6}
          maxLength={2400}
          className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-ring"
          placeholder="Hi, I'm Anjali. I started cooking from my mother's recipe book…"
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Cuisines" hint="Comma-separated">
          <input
            value={cuisines}
            onChange={(e) => setCuisines(e.target.value)}
            placeholder="South Indian, Tamil, Vegetarian"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"
          />
        </Card>
        <Card title="Specialties" hint="Comma-separated">
          <input
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            placeholder="Dosa, Filter Coffee, Homemade Sambar"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"
          />
        </Card>
      </div>

      <Card title="Gallery" hint="Add up to 20 photos — food, kitchen, packaging">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {gallery.map((g, i) => (
            <div key={`${g.url}-${i}`} className="relative aspect-square overflow-hidden rounded-xl bg-secondary">
              <img src={g.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setGallery(gallery.filter((_, j) => j !== i))}
                className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-destructive hover:bg-background"
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {gallery.length < 20 && (
            <GalleryAdd
              onUpload={async (f) => setGallery([...gallery, await uploadFile(f, "gallery")])}
            />
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saveMut.isPending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save storefront
        </button>
      </div>
    </form>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ImageDrop({
  value,
  onUpload,
  onClear,
  aspect,
}: {
  value: ImgUpload | null;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
  aspect: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className={`relative ${aspect} w-full overflow-hidden rounded-xl border border-dashed border-border bg-surface`}>
      {value?.url ? (
        <>
          <img src={value.url} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-destructive hover:bg-background"
            aria-label="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="grid h-full w-full place-items-center gap-2 text-sm text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
          Click to upload
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try { await onUpload(f); } catch (err: any) { toast.error(err.message); }
          setBusy(false);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function GalleryAdd({ onUpload }: { onUpload: (f: File) => Promise<void> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="grid aspect-square place-items-center rounded-xl border border-dashed border-border bg-surface text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try { await onUpload(f); } catch (err: any) { toast.error(err.message); }
          setBusy(false);
          e.target.value = "";
        }}
      />
    </>
  );
}

function extractPath(signedUrl: string, bucket: string): string | null {
  const m = signedUrl.match(new RegExp(`/${bucket}/([^?]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
