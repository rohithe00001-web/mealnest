import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { sendOtp, verifyOtp } from "@/lib/otp.functions";
import { toast } from "sonner";
import { ChefHat, Phone, Mail } from "lucide-react";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
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
  const [method, setMethod] = useState<"phone" | "email">("phone");

  // shared
  const [role, setRole] = useState<Role>("customer");
  const [loading, setLoading] = useState(false);

  // phone flow
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // email fallback
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const dest = redirect || ROLE_DEST[role];

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function startTimer(seconds: number) {
    setSecondsLeft(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  async function onSendOtp(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await sendOtp({ data: { countryCode, phone, channel: "sms" } });
      if (!res.ok) { toast.error(res.reason); return; }
      setStep("otp");
      setCode("");
      setDevCode(res.dev_code ?? null);
      startTimer(res.expires_in);
      if (res.dev_code) toast.success(`Dev OTP: ${res.dev_code}`);
      else toast.success("OTP sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send OTP");
    } finally { setLoading(false); }
  }

  async function onVerifyOtp(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await verifyOtp({ data: { countryCode, phone, code, role, fullName: fullName || undefined } });
      if (!res.ok) { toast.error(res.reason); return; }
      const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: res.token_hash });
      if (error) { toast.error(error.message); return; }
      toast.success("Signed in");
      navigate({ to: dest });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally { setLoading(false); }
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
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
            <p className="mt-1 text-sm text-muted-foreground">Sign in or sign up with your mobile number</p>
          </div>

          {/* Role selector */}
          <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1 text-xs">
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`h-9 rounded-xl font-medium transition ${role === r ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>

          {method === "phone" ? (
            step === "phone" ? (
              <form onSubmit={onSendOtp} className="mt-5 space-y-3">
                <label className="block text-sm font-medium">Mobile number</label>
                <div className="flex gap-2">
                  <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}
                    className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring">
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+65">🇸🇬 +65</option>
                  </select>
                  <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="98765 43210" inputMode="numeric" maxLength={15} required
                    className="h-11 flex-1 rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-ring" />
                </div>
                {role !== "customer" && (
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder={role === "seller" ? "Owner name" : "Full name"}
                    className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-ring" />
                )}
                <button type="submit" disabled={loading || phone.length < 6}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {loading ? "Sending…" : "Send OTP"}
                </button>
                <p className="text-xs text-muted-foreground text-center">
                  We'll text a 6-digit code to {countryCode} {phone || "your number"}.
                </p>
              </form>
            ) : (
              <form onSubmit={onVerifyOtp} className="mt-5 space-y-3">
                <label className="block text-sm font-medium">Enter the 6-digit code</label>
                <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••" inputMode="numeric" maxLength={6} required autoFocus
                  className="h-12 w-full rounded-xl border border-input bg-background px-4 text-center font-mono text-xl tracking-[0.4em] outline-none focus:border-ring" />
                {role === "customer" && !fullName && (
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name (for new accounts)"
                    className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-ring" />
                )}
                <button type="submit" disabled={loading || code.length !== 6}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {loading ? "Verifying…" : "Verify & continue"}
                </button>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button type="button" onClick={() => { setStep("phone"); setCode(""); setDevCode(null); }}
                    className="hover:text-foreground">← Change number</button>
                  {secondsLeft > 0 ? (
                    <span>Resend in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</span>
                  ) : (
                    <button type="button" onClick={() => onSendOtp()} className="font-medium text-primary hover:underline">Resend OTP</button>
                  )}
                </div>
                {devCode && (
                  <p className="rounded-xl border border-dashed border-border bg-muted/40 p-2 text-center text-xs text-muted-foreground">
                    Dev mode — your code is <span className="font-mono font-semibold text-foreground">{devCode}</span>
                  </p>
                )}
              </form>
            )
          ) : (
            <>
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
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {mode === "signin" ? "New here? " : "Have an account? "}
                <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="font-medium text-primary hover:underline">
                  {mode === "signin" ? "Create account" : "Sign in"}
                </button>
              </p>
            </>
          )}

          <button onClick={() => setMethod(method === "phone" ? "email" : "phone")}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            {method === "phone" ? <><Mail className="h-3.5 w-3.5" /> Use email instead</> : <><Phone className="h-3.5 w-3.5" /> Use mobile instead</>}
          </button>

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
