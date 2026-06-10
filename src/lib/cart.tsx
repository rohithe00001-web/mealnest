import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface CartItem {
  dishId: string;
  sellerId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  quantity: number;
}

interface CartCtx {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQty: (dishId: string, qty: number) => void;
  remove: (dishId: string) => void;
  clear: () => void;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "homebite_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const add = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
    setItems((prev) => {
      // Restrict cart to single seller for simplicity
      const differentSeller = prev.find((p) => p.sellerId !== item.sellerId);
      const base = differentSeller ? [] : prev;
      const existing = base.find((p) => p.dishId === item.dishId);
      if (existing) {
        return base.map((p) => (p.dishId === item.dishId ? { ...p, quantity: p.quantity + qty } : p));
      }
      return [...base, { ...item, quantity: qty }];
    });
  }, []);

  const setQty = useCallback((dishId: string, qty: number) => {
    setItems((prev) => prev.flatMap((p) => (p.dishId === dishId ? (qty <= 0 ? [] : [{ ...p, quantity: qty }]) : [p])));
  }, []);

  const remove = useCallback((dishId: string) => {
    setItems((prev) => prev.filter((p) => p.dishId !== dishId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartCtx>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((n, i) => n + i.price * i.quantity, 0),
      add,
      setQty,
      remove,
      clear,
    }),
    [items, add, setQty, remove, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
