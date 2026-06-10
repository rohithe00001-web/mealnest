import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/format";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const { items, subtotal, setQty, remove, count } = useCart();
  const { user } = useAuth();
  const deliveryFee = subtotal >= 500 || subtotal === 0 ? 0 : 29;
  const total = subtotal + deliveryFee;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container-page flex-1 py-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Your cart</h1>

        {count === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-display text-xl">Your cart is empty</p>
            <Link to="/browse" className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Browse dishes</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
            <ul className="space-y-3">
              {items.map((it) => (
                <li key={it.dishId} className="flex items-center gap-4 rounded-2xl bg-card p-3 shadow-[var(--shadow-soft)]">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {it.imageUrl && <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{it.name}</p>
                    <p className="text-sm text-muted-foreground">{inr(it.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(it.dishId, it.quantity - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-6 text-center text-sm font-medium">{it.quantity}</span>
                    <button onClick={() => setQty(it.dishId, it.quantity + 1)} className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  <button onClick={() => remove(it.dishId)} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <aside className="h-fit rounded-2xl border border-border bg-card p-6">
              <h3 className="font-display text-xl font-semibold">Order summary</h3>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{inr(subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd>{deliveryFee === 0 ? "Free" : inr(deliveryFee)}</dd></div>
                <div className="flex justify-between border-t border-border pt-3 text-base font-semibold"><dt>Total</dt><dd>{inr(total)}</dd></div>
              </dl>
              {user ? (
                <Link to="/checkout" className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90">Checkout</Link>
              ) : (
                <Link to="/auth" search={{ redirect: "/cart" }} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90">Sign in to checkout</Link>
              )}
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
