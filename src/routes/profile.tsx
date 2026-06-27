import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardList, Heart, MapPin, Smartphone, Sparkles, Store, ChefHat,
  ShieldCheck, LogOut, ChevronRight, Settings, HelpCircle, CalendarDays, User as UserIcon,
  Bike, Repeat,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/admin.functions";
import { getMyDeliveryApplication } from "@/lib/delivery.functions";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — MealNest" },
      { name: "description", content: "Manage your MealNest profile, orders, addresses and rewards." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

interface CardItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc?: string;
}

function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const checkAdmin = useServerFn(checkIsAdmin);
  const myApplicationFn = useServerFn(getMyDeliveryApplication);
  const { data: adminData } = useQuery({
    queryKey: ["me", "is-admin", user?.id ?? "anon"],
    queryFn: () => checkAdmin(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const { data: applications = [] } = useQuery({
    queryKey: ["me", "delivery-application", user?.id ?? "anon"],
    queryFn: () => myApplicationFn(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const isAdmin = !!adminData?.isAdmin;
  const latestApplication = (applications as any[])[0];
  const isApprovedAgent = latestApplication?.status === "approved";

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/", replace: true });
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
          <UserIcon className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold">You're signed out</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to view your profile, orders and rewards.</p>
        <Link to="/auth" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Sign in
        </Link>
      </div>
    );
  }

  const primary: CardItem[] = [
    { to: "/orders", label: "My Orders", icon: ClipboardList, desc: "Track & reorder" },
    { to: "/my-subscriptions", label: "Subscriptions", icon: CalendarDays, desc: "Active plans" },
    { to: "/addresses", label: "Addresses", icon: MapPin, desc: "Delivery locations" },
    { to: "/wishlist", label: "Wishlist", icon: Heart, desc: "Saved dishes" },
    { to: "/rewards", label: "Rewards & Coins", icon: Sparkles, desc: "Earn & redeem" },
    { to: "/devices", label: "Trusted Devices", icon: Smartphone, desc: "Manage sign-ins" },
  ];

  const secondary: CardItem[] = [
    { to: "/seller", label: "Seller dashboard", icon: Store },
    { to: "/become-seller", label: "Become a seller", icon: ChefHat },
  ];

  const displayName = (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Friend";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <main className="container-page py-6 sm:py-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-full bg-primary text-primary-foreground font-display text-xl font-semibold shadow-soft">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Welcome back</p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold truncate">{displayName}</h1>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <Link to="/rewards" className="rounded-2xl bg-card p-3 text-center transition-transform active:scale-95">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Coins</p>
            <p className="font-display text-lg font-semibold">—</p>
          </Link>
          <Link to="/orders" className="rounded-2xl bg-card p-3 text-center transition-transform active:scale-95">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Orders</p>
            <p className="font-display text-lg font-semibold">View</p>
          </Link>
          <Link to="/my-subscriptions" className="rounded-2xl bg-card p-3 text-center transition-transform active:scale-95">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Plans</p>
            <p className="font-display text-lg font-semibold">Manage</p>
          </Link>
        </div>
      </section>

      {/* Primary actions */}
      <section className="mt-6">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</h2>
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:gap-3">
          {primary.map((it) => {
            const Icon = it.icon;
            return (
              <li key={it.to}>
                <Link
                  to={it.to}
                  className="group flex h-full items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all active:scale-[0.98] hover:border-primary/40"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.label}</p>
                    {it.desc && <p className="truncate text-[11px] text-muted-foreground">{it.desc}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* For sellers */}
      <section className="mt-6">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">For sellers</h2>
        <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
          {secondary.map((it) => {
            const Icon = it.icon;
            return (
              <li key={it.to}>
                <Link to={it.to} className="flex items-center gap-3 p-4 transition-colors hover:bg-muted">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium">{it.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
          {isAdmin && (
            <li>
              <Link to="/admin" className="flex items-center gap-3 p-4 transition-colors hover:bg-muted">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-medium">Admin panel</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          )}
        </ul>
      </section>

      {/* Help / sign out */}
      <section className="mt-6">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">More</h2>
        <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
          <li>
            <Link to="/trust" className="flex items-center gap-3 p-4 transition-colors hover:bg-muted">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <HelpCircle className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-medium">Trust & safety</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
          <li>
            <Link to="/privacy" className="flex items-center gap-3 p-4 transition-colors hover:bg-muted">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <Settings className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-medium">Privacy</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
          <li>
            <button onClick={signOut} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <LogOut className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-medium text-destructive">Sign out</span>
            </button>
          </li>
        </ul>
      </section>
    </main>
  );
}
