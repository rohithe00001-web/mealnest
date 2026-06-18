import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChefHat } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Recovery links arrive with #access_token… — Supabase parses the hash
    // and emits PASSWORD_RECOVERY on the client.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Fallback: if user already has a session from the link, still allow update.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
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
            <h1 className="mt-4 font-display text-3xl font-semibold">Set a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {ready ? "Choose a password you haven't used before." : "Waiting for the recovery link…"}
            </p>
          </div>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" required minLength={6} disabled={!ready}
              className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-ring disabled:opacity-50" />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" required minLength={6} disabled={!ready}
              className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-ring disabled:opacity-50" />
            <button type="submit" disabled={loading || !ready}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/auth" className="hover:text-foreground">← Back to sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
