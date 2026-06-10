import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";

export type AppNotification = {
  id: string;
  title: string;
  body?: string;
  href?: string;
  createdAt: number;
  read: boolean;
};

interface Ctx {
  items: AppNotification[];
  unread: number;
  markAllRead: () => void;
  clear: () => void;
  push: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
}

const NCtx = createContext<Ctx>({ items: [], unread: 0, markAllRead: () => {}, clear: () => {}, push: () => {} });

const STATUS_LABEL: Record<string, string> = {
  placed: "Order placed",
  accepted: "Accepted by the kitchen",
  preparing: "Being cooked",
  ready: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered — enjoy!",
  cancelled: "Order cancelled",
  rejected: "Order rejected",
};

function storageKey(uid: string) { return `homebite.notifs.${uid}`; }

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [items, setItems] = useState<AppNotification[]>([]);

  // Load from storage on auth change
  useEffect(() => {
    if (!user) { setItems([]); return; }
    try {
      const raw = localStorage.getItem(storageKey(user.id));
      setItems(raw ? JSON.parse(raw) : []);
    } catch { setItems([]); }
  }, [user?.id]);

  const persist = useCallback((next: AppNotification[]) => {
    if (user) try { localStorage.setItem(storageKey(user.id), JSON.stringify(next.slice(0, 50))); } catch {}
  }, [user?.id]);

  const push = useCallback((n: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    setItems((prev) => {
      const next = [
        { ...n, id: crypto.randomUUID(), createdAt: Date.now(), read: false },
        ...prev,
      ].slice(0, 50);
      persist(next);
      return next;
    });
  }, [persist]);

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((i) => ({ ...i, read: true }));
      persist(next);
      return next;
    });
  }, [persist]);

  const clear = useCallback(() => {
    setItems([]);
    if (user) try { localStorage.removeItem(storageKey(user.id)); } catch {}
  }, [user?.id]);

  // Customer: subscribe to my orders updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-customer-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `customer_id=eq.${user.id}` },
        (payload: any) => {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          if (!newStatus || oldStatus === newStatus) return;
          const label = STATUS_LABEL[newStatus] ?? newStatus;
          const num = payload.new.order_number ?? "";
          toast.success(`${num}: ${label}`);
          push({ title: `${num}`, body: label, href: `/orders/${payload.new.id}` });
          qc.invalidateQueries({ queryKey: ["orders", "mine"] });
          qc.invalidateQueries({ queryKey: ["order", payload.new.id] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, push, qc]);

  // Seller: subscribe to new orders for my kitchen
  const [sellerId, setSellerId] = useState<string | null>(null);
  useEffect(() => {
    if (!user) { setSellerId(null); return; }
    let cancelled = false;
    supabase.from("sellers").select("id").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (!cancelled) setSellerId(data?.id ?? null);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!sellerId) return;
    const ch = supabase
      .channel(`notif-seller-${sellerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `seller_id=eq.${sellerId}` },
        (payload: any) => {
          const num = payload.new.order_number ?? "";
          const total = Number(payload.new.total ?? 0);
          toast.success(`New order ${num}`, { description: `₹${total}` });
          push({ title: `New order ${num}`, body: `₹${total}`, href: `/seller/orders` });
          qc.invalidateQueries({ queryKey: ["seller"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sellerId, push, qc]);

  const value = useMemo<Ctx>(() => ({
    items,
    unread: items.filter((i) => !i.read).length,
    markAllRead, clear, push,
  }), [items, markAllRead, clear, push]);

  return <NCtx.Provider value={value}>{children}</NCtx.Provider>;
}

export function useNotifications() { return useContext(NCtx); }
