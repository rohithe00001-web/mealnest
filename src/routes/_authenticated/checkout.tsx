import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { placeOrder } from "@/lib/orders.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const placeOrderFn = useServerFn(placeOrder);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    label: "Home", addressLine: "", city: "", pincode: "", phone: "", instructions: "",
  });

  const deliveryFee = subtotal >= 500 || subtotal === 0 ? 0 : 29;
  const total = subtotal + deliveryFee;

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="container-page flex-1 py-16 text-center">
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Link to="/browse" className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">Browse</Link>
        </main>
        <Footer />
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await placeOrderFn({
        data: {
          sellerId: items[0].sellerId,
          items: items.map((i) => ({ dishId: i.dishId, quantity: i.quantity })),
          deliveryAddress: {
            label: form.label, addressLine: form.addressLine, city: form.city,
            pincode: form.pincode || undefined, phone: form.phone,
          },
          deliveryInstructions: form.instructions || undefined,
          paymentMethod: "cod",
        },
      });
      clear();
      toast.success(`Order ${res.orderNumber} placed!`);
      navigate({ to: "/orders" });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to place order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Checkout</h1>
        <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-semibold">Delivery address</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Label" value={form.label} onChange={(v) => setForm({ ...form, label: v })} />
                <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
                <div className="sm:col-span-2">
                  <Field label="Address" value={form.addressLine} onChange={(v) => setForm({ ...form, addressLine: v })} required />
                </div>
                <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
                <Field label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} />
                <div className="sm:col-span-2">
                  <Field label="Delivery instructions (optional)" value={form.instructions} onChange={(v) => setForm({ ...form, instructions: v })} />
                </div>
              </div>
            </section>
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-semibold">Payment</h2>
              <p className="mt-2 text-sm text-muted-foreground">Cash on Delivery — pay the cook when your food arrives.</p>
            </section>
          </div>

          <aside className="h-fit rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-xl font-semibold">Summary</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {items.map((i) => (
                <li key={i.dishId} className="flex justify-between gap-3">
                  <span className="truncate">{i.name} × {i.quantity}</span>
                  <span>{inr(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{inr(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd>{deliveryFee === 0 ? "Free" : inr(deliveryFee)}</dd></div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd>{inr(total)}</dd></div>
            </dl>
            <button type="submit" disabled={loading} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? "Placing order…" : "Place order"}
            </button>
          </aside>
        </form>
      </main>
      <Footer />
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}{required && " *"}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-ring" />
    </label>
  );
}
