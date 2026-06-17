import { Link, useRouter } from "@tanstack/react-router";
import { ShoppingBag, Search, User as UserIcon, LogOut, ClipboardList, ChefHat, ShieldCheck, Heart, MapPin, Store, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/admin.functions";
import { NotificationBell } from "@/components/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user } = useAuth();
  const { count } = useCart();
  const router = useRouter();
  const checkAdmin = useServerFn(checkIsAdmin);
  const { data: adminData } = useQuery({
    queryKey: ["me", "is-admin", user?.id ?? "anon"],
    queryFn: () => checkAdmin(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const isAdmin = !!adminData?.isAdmin;

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container-page flex h-16 items-center gap-3 sm:gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="MealNest home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <svg viewBox="0 0 64 64" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M14 26 L32 12 L50 26" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 40c0-6 9-10 20-10s20 4 20 10c0 3-2 5-5 5H17c-3 0-5-2-5-5z" fill="currentColor" opacity=".95"/>
            </svg>
          </span>
          <span className="text-xl font-display font-semibold tracking-tight">MealNest</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-muted-foreground">
          <Link to="/browse" className="rounded-md px-3 py-2 transition-colors hover:bg-muted hover:text-foreground">
            Browse
          </Link>
          <Link to="/meal-plans" className="rounded-md px-3 py-2 transition-colors hover:bg-muted hover:text-foreground">
            Meal Plans
          </Link>
          <Link to="/" hash="kitchens" className="rounded-md px-3 py-2 transition-colors hover:bg-muted hover:text-foreground">
            Kitchens
          </Link>
        </nav>

        <div className="flex-1" />

        <Link
          to="/browse"
          className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Search className="h-4 w-4" />
          <span>Search dishes or kitchens</span>
        </Link>

        {user && <NotificationBell />}

        <Link
          to="/cart"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface hover:bg-muted transition-colors"
          aria-label="Cart"
        >
          <ShoppingBag className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
              {count}
            </span>
          )}
        </Link>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface hover:bg-muted transition-colors" aria-label="Account">
                <UserIcon className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/orders"><ClipboardList className="mr-2 h-4 w-4" />My Orders</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/my-subscriptions"><ClipboardList className="mr-2 h-4 w-4" />My Subscriptions</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/wishlist"><Heart className="mr-2 h-4 w-4" />Wishlist</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/rewards"><Sparkles className="mr-2 h-4 w-4" />Rewards & coins</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/addresses"><MapPin className="mr-2 h-4 w-4" />Addresses</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/seller"><Store className="mr-2 h-4 w-4" />Seller dashboard</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/become-seller"><ChefHat className="mr-2 h-4 w-4" />Become a seller</Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/admin"><ShieldCheck className="mr-2 h-4 w-4" />Admin panel</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            to="/auth"
            className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
