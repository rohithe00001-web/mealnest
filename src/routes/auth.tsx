import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useEffect, useState, type FormEvent } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ChefHat } from "lucide-react";
import { getDeviceFingerprint } from "@/lib/device";
import { checkDeviceForSignup, linkDeviceToCurrentUser, requestDeviceOverride } from "@/lib/devices.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — MealNest" },
      { name: "description", content: "Sign in or create your MealNest account to order homemade meals from neighborhood kitchens." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Sign in — MealNest" },
      { property: "og:url", content: "/auth" },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
});

type Role = "customer" | "seller" | "delivery_agent";
const ROLE_LABEL: Record<Role, string> = {
  customer: "Customer",
  seller: "Home chef",
  delivery_agent: "Delivery partner",
};
const ROLE_DEST: Record<Role, string> = {
  customer: "/",
  seller: "/seller",
  delivery_agent: "/delivery",
};

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [role, setRole] = useState<Role>("customer");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideContact, setOverrideContact] = useState("");
  const checkFn = useServerFn(checkDeviceForSignup);
  const linkFn = useServerFn(linkDeviceToCurrentUser);
  const overrideFn = useServerFn(requestDeviceOverride);

  const dest = redirect || ROLE_DEST[role];

  useEffect(() => {
    if (user) navigate({ to: dest, replace: true });
  }, [user, dest, navigate]);

  async function onForgotPassword() {
    if (!email) return toast.error("Enter your email above, then tap Forgot password");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Check your email for a reset link");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, role }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: dest });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) { toast.error(result.error.message); return; }
      if (result.redirected) return;
      navigate({ to: dest });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-[var(--shadow-card)]">
          <div className="flex flex-col items-center text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><ChefHat className="h-6 w-6" /></span>
            <h1 className="mt-4 font-display text-3xl font-semibold">Welcome to MealNest</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in or create your account</p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1 text-xs">
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`h-9 rounded-xl font-medium transition ${role === r ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>

          <button onClick={onGoogle} disabled={loading} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted disabled:opacity-50">
            <GoogleIcon /> Continue with Google
          </button>
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={onEmailSubmit} className="space-y-3">
            {mode === "signup" && (
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required
                className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-ring" />
            )}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required
              className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-ring" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required minLength={6}
              className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-ring" />
            <button type="submit" disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          {mode === "signin" && (
            <p className="mt-3 text-center text-xs">
              <button type="button" onClick={onForgotPassword} disabled={loading}
                className="text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50">
                Forgot password?
              </button>
            </p>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here? " : "Have an account? "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="font-medium text-primary hover:underline">
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </p>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
  );
}
