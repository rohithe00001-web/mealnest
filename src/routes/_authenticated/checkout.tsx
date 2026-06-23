import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AddressPicker } from "@/components/AddressPicker";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { placeOrder } from "@/lib/orders.functions";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/razorpay.functions";
import { listAddresses } from "@/lib/customer.functions";
import { previewCoupon, listApplicableCoupons } from "@/lib/coupons.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/checkout")({
  component: CheckoutPage,
});

const RZP_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = RZP_SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const placeOrderFn = useServerFn(placeOrder);
  const createRzpFn = useServerFn(createRazorpayOrder);
  const verifyRzpFn = useServerFn(verifyRazorpayPayment);
  const listAddressesFn = useServerFn(listAddresses);
  const previewFn = useServerFn(previewCoupon);
  const listCouponsFn = useServerFn(listApplicableCoupons);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | "new">("new");
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "cod">("razorpay");
  const [couponCode, setCouponCode] = useState("");
  const [couponState, setCouponState] = useState<{ code: string; discount: number; type: string } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [form, setForm] = useState({
    label: "Home", addressLine: "", city: "", pincode: "", phone: "", instructions: "",
    lat: null as number | null, lng: null as number | null, formatted: "",
  });

  const sellerId = items[0]?.sellerId;
  const { data: applicable } = useQuery({
    queryKey: ["applicable-coupons", sellerId, subtotal],
    queryFn: () => listCouponsFn({ data: { sellerId, orderTotal: subtotal, kind: "order" } }),
    enabled: !!sellerId && subtotal > 0,
  });

  const { data: addresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => listAddressesFn(),
  });

  useEffect(() => {
    if (addresses && addresses.length > 0 && selectedId === "new") {
      const def = addresses.find((a: any) => a.is_default) ?? addresses[0];
      setSelectedId(def.id);
    }
  }, [addresses]);

  // Pre-load Razorpay script so the modal opens instantly when the user clicks Pay.
  useEffect(() => {
    loadRazorpay();
  }, []);

  let deliveryFee = subtotal >= 500 || subtotal === 0 ? 0 : 29;
  let couponDiscount = 0;
  if (couponState) {
    if (couponState.type === "free_delivery") deliveryFee = 0;
    else if (couponState.type === "partial_delivery") deliveryFee = Math.max(0, deliveryFee - couponState.discount);
    else couponDiscount = couponState.discount;
  }
  const total = Math.max(0, subtotal + deliveryFee - couponDiscount);

  async function applyCoupon(codeArg?: string) {
    const code = (codeArg ?? couponCode).trim();
    if (!code) return;
    setCouponBusy(true);
    try {
      const res = await previewFn({ data: { code, sellerId: items[0]?.sellerId, orderTotal: subtotal, kind: "order" } });
      if (!res.valid) { toast.error(res.reason || "Invalid"); setCouponState(null); return; }
      setCouponState({ code: code.toUpperCase(), discount: res.discount, type: res.discountType ?? "flat" });
      setCouponCode(code.toUpperCase());
      toast.success("Coupon applied");
    } catch (e: any) { toast.error(e.message); }
    finally { setCouponBusy(false); }
  }

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

  function buildDeliveryAddress() {
    if (selectedId !== "new" && addresses) {
      const a: any = addresses.find((x: any) => x.id === selectedId);
      if (!a) throw new Error("Address not found");
      if (!form.phone) throw new Error("Phone is required");
      return {
        label: a.label, addressLine: a.address_line, city: a.city,
        pincode: a.pincode || undefined, phone: form.phone,
        lat: a.latitude != null ? Number(a.latitude) : undefined,
        lng: a.longitude != null ? Number(a.longitude) : undefined,
      };
    }
    return {
      label: form.label, addressLine: form.addressLine, city: form.city,
      pincode: form.pincode || undefined, phone: form.phone,
      lat: form.lat ?? undefined, lng: form.lng ?? undefined,
      formatted: form.formatted || undefined,
    };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const deliveryAddress = buildDeliveryAddress();

      if (paymentMethod === "cod") {
        const res = await placeOrderFn({
          data: {
            sellerId: items[0].sellerId,
            items: items.map((i) => ({ dishId: i.dishId, quantity: i.quantity })),
            deliveryAddress,
            deliveryInstructions: form.instructions || undefined,
            paymentMethod: "cod",
            couponCode: couponState?.code,
          },
        });
        clear();
        toast.success(`Order ${res.orderNumber} placed!`);
        navigate({ to: "/orders" });
        return;
      }

      // Razorpay flow
      const ready = await loadRazorpay();
      if (!ready) throw new Error("Could not load payment gateway. Check your connection.");

      const rp = await createRzpFn({
        data: {
          sellerId: items[0].sellerId,
          items: items.map((i) => ({ dishId: i.dishId, quantity: i.quantity })),
          deliveryAddress,
          deliveryInstructions: form.instructions || undefined,
          couponCode: couponState?.code,
        },
      });

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: rp.keyId,
          amount: rp.amount,
          currency: rp.currency,
          order_id: rp.razorpayOrderId,
          name: "MealNest",
          description: `Order ${rp.orderNumber ?? ""}`.trim(),
          prefill: { contact: deliveryAddress.phone },
          notes: { order_id: rp.orderId },
          theme: { color: "#f97316" },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled")),
          },
          handler: async (response: any) => {
            try {
              await verifyRzpFn({
                data: {
                  orderId: rp.orderId,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                },
              });
              clear();
              toast.success(`Payment successful! Order ${rp.orderNumber} confirmed.`);
              navigate({ to: "/orders" });
              resolve();
            } catch (err: any) {
              reject(err);
            }
          },
        });
        rzp.on("payment.failed", (resp: any) => {
          reject(new Error(resp?.error?.description ?? "Payment failed"));
        });
        rzp.open();
      });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to place order");
    } finally {
      setLoading(false);
    }
  }

  const usingSaved = selectedId !== "new";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Checkout</h1>
        <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">Delivery address</h2>
                <Link to="/addresses" className="text-xs text-primary hover:underline">Manage</Link>
              </div>

              {addresses && addresses.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {addresses.map((a: any) => (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={`text-left rounded-xl border p-3 transition-colors ${
                        selectedId === a.id ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{a.label}</span>
                        {a.is_default && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Default</span>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.address_line}, {a.city}{a.pincode ? ` · ${a.pincode}` : ""}</p>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedId("new")}
                    className={`text-left rounded-xl border border-dashed p-3 transition-colors ${
                      selectedId === "new" ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <span className="text-sm font-medium">+ Use a new address</span>
                    <p className="mt-1 text-xs text-muted-foreground">Enter details below</p>
                  </button>
                </div>
              )}

              {usingSaved ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
                  <div className="sm:col-span-2">
                    <Field label="Delivery instructions (optional)" value={form.instructions} onChange={(v) => setForm({ ...form, instructions: v })} />
                  </div>
                </div>
              ) : (
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
              )}
            </section>
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-semibold">Payment</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("razorpay")}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    paymentMethod === "razorpay" ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
                  }`}
                >
                  <div className="text-sm font-semibold">Pay online</div>
                  <p className="mt-1 text-xs text-muted-foreground">Cards, UPI, wallets &amp; netbanking — secured by Razorpay.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cod")}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
                  }`}
                >
                  <div className="text-sm font-semibold">Cash on Delivery</div>
                  <p className="mt-1 text-xs text-muted-foreground">Pay the cook when your food arrives.</p>
                </button>
              </div>
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
            {!couponState && applicable && (applicable.best || applicable.seller.length + applicable.platform.length + applicable.subscription.length > 0) && (
              <div className="mt-4 space-y-3 border-t border-border pt-3">
                {applicable.best && (
                  <div className="rounded-xl border border-accent/40 bg-accent/10 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-accent">Best for you</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold">{applicable.best.code}</p>
                        {applicable.best.description && <p className="text-xs text-muted-foreground">{applicable.best.description}</p>}
                        <p className="mt-1 text-xs font-medium text-accent">You save {inr(applicable.best.netValue)}</p>
                      </div>
                      <button type="button" onClick={() => applyCoupon(applicable.best!.code)} disabled={couponBusy} className="h-8 shrink-0 rounded-full bg-accent px-3 text-xs font-medium text-accent-foreground disabled:opacity-50">Apply</button>
                    </div>
                  </div>
                )}
                {(["seller", "platform", "subscription"] as const).map((group) => {
                  const list = applicable[group];
                  if (!list || list.length === 0) return null;
                  const label = group === "seller" ? "From this kitchen" : group === "subscription" ? "Subscription offers" : "Platform offers";
                  return (
                    <details key={group} className="rounded-xl border border-border bg-background/40">
                      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground">
                        {label} <span className="text-foreground/60">({list.length})</span>
                      </summary>
                      <ul className="divide-y divide-border">
                        {list.map((c) => (
                          <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-semibold">{c.code}</p>
                              {c.description && <p className="truncate text-[11px] text-muted-foreground">{c.description}</p>}
                              <p className="text-[11px] text-accent">−{inr(c.netValue)}</p>
                            </div>
                            <button type="button" onClick={() => applyCoupon(c.code)} disabled={couponBusy} className="h-7 shrink-0 rounded-full border border-primary px-3 text-[11px] font-medium text-primary disabled:opacity-50">Apply</button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </div>
            )}
            <div className="mt-4 space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">Coupon code</p>
              {couponState ? (
                <div className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 p-2 text-sm">
                  <span className="font-mono font-semibold">{couponState.code}</span>
                  <button type="button" onClick={() => { setCouponState(null); setCouponCode(""); }} className="text-xs text-destructive hover:underline">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Enter code" className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm" />
                  <button type="button" onClick={() => applyCoupon()} disabled={couponBusy} className="h-10 rounded-full border border-primary px-4 text-sm font-medium text-primary disabled:opacity-50">{couponBusy ? "…" : "Apply"}</button>
                </div>
              )}
            </div>
            <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{inr(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd>{deliveryFee === 0 ? "Free" : inr(deliveryFee)}</dd></div>
              {couponDiscount > 0 && <div className="flex justify-between text-accent"><dt>Coupon ({couponState?.code})</dt><dd>−{inr(couponDiscount)}</dd></div>}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd>{inr(total)}</dd></div>
            </dl>
            <button type="submit" disabled={loading} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? "Processing…" : paymentMethod === "razorpay" ? `Pay ${inr(total)}` : "Place order"}
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
