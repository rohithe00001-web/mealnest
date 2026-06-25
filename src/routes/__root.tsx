import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { NotificationsProvider } from "@/lib/notifications";
import { Toaster } from "@/components/ui/sonner";
import { ensureDeviceRegistered } from "@/lib/device";
import { AppChrome } from "@/components/AppChrome";
import { useRouterState } from "@tanstack/react-router";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has moved.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a href="/" className="rounded-full border border-input bg-background px-4 py-2 text-sm hover:bg-accent">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MealNest – Homemade Food Delivery & Meal Subscriptions" },
      { name: "description", content: "Discover fresh homemade meals from trusted home chefs. Subscribe for weekly, 15-day, or monthly meal plans with reliable delivery through MealNest." },
      { name: "theme-color", content: "#FF7A00" },
      { property: "og:title", content: "MealNest – Homemade Food Delivery & Meal Subscriptions" },
      { property: "og:description", content: "Discover fresh homemade meals from trusted home chefs. Subscribe for weekly, 15-day, or monthly meal plans with reliable delivery through MealNest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MealNest – Homemade Food Delivery & Meal Subscriptions" },
      { name: "twitter:description", content: "Discover fresh homemade meals from trusted home chefs. Subscribe for weekly, 15-day, or monthly meal plans with reliable delivery through MealNest." },
      { property: "og:image", content: "/og-image.png" },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/icon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/icons/icon-16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { ensureDeviceRegistered().catch(() => {}); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationsProvider>
          <CartProvider>
            <ShellOutlet />
            <AppChrome />
            <Toaster richColors position="top-center" />
          </CartProvider>
        </NotificationsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const CHROME_HIDE = ["/admin", "/seller", "/delivery", "/auth", "/reset-password"];
function ShellOutlet() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hide = CHROME_HIDE.some((p) => pathname.startsWith(p));
  if (hide) return <Outlet />;
  return (
    <div className="lg:pl-16 pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] lg:pb-0">
      <Outlet />
    </div>
  );
}
