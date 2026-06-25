import { useRouterState } from "@tanstack/react-router";
import { MobileBottomNav } from "./MobileBottomNav";
import { DesktopSideNav } from "./DesktopSideNav";
import { FloatingCart } from "./FloatingCart";

// Routes where we hide the consumer chrome (admin, seller, delivery, auth).
const HIDE_PREFIXES = ["/admin", "/seller", "/delivery", "/auth", "/reset-password"];

export function AppChrome() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hide = HIDE_PREFIXES.some((p) => pathname.startsWith(p));
  if (hide) return null;
  return (
    <>
      <DesktopSideNav />
      <MobileBottomNav />
      <FloatingCart />
    </>
  );
}

export function AppChromeOffset() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hide = HIDE_PREFIXES.some((p) => pathname.startsWith(p));
  if (hide) return null;
  // Reserve space so fixed bottom nav / sidebar don't overlap content.
  return (
    <div
      aria-hidden
      className="lg:hidden"
      style={{ height: "calc(env(safe-area-inset-bottom, 0px) + 4rem)" }}
    />
  );
}
