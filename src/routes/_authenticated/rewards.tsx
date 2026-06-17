import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Coins, Flame, Gift, Share2, Sparkles, Cake, Copy, Check } from "lucide-react";
import {
  getMyLoyalty,
  generateReferralCode,
  applyReferralCode,
  redeemCoins,
  updateBirthday,
} from "@/lib/loyalty.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rewards")({
  component: RewardsPage,
  head: () => ({ meta: [{ title: "Rewards — MealNest" }] }),
});

const REDEEM_TIERS = [100, 250, 500, 1000];

function RewardsPage() {
  const qc = useQueryClient();
  const fetchLoyalty = useServerFn(getMyLoyalty);
  const genCode = useServerFn(generateReferralCode);
  const applyCode = useServerFn(applyReferralCode);
  const redeem = useServerFn(redeemCoins);
  const saveDob = useServerFn(updateBirthday);

  const { data, isLoading } = useQuery({ queryKey: ["loyalty"], queryFn: () => fetchLoyalty() });
  const [refInput, setRefInput] = useState("");
  const [dob, setDob] = useState("");
  const [anniv, setAnniv] = useState("");
  const [copied, setCopied] = useState(false);
  const [lastCoupon, setLastCoupon] = useState<{ code: string; discount: number } | null>(null);

  const genM = useMutation({
    mutationFn: () => genCode(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loyalty"] }); toast.success("Referral code ready"); },
    onError: (e: any) => toast.error(e.message),
  });
  const applyM = useMutation({
    mutationFn: (code: string) => applyCode({ data: { code } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loyalty"] }); setRefInput(""); toast.success("Referral applied. You'll get 100 coins on your first order."); },
    onError: (e: any) => toast.error(e.message),
  });
  const redeemM = useMutation({
    mutationFn: (coins: number) => redeem({ data: { coins } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["loyalty"] }); setLastCoupon(r); toast.success(`Coupon ${r.code} ready at checkout!`); },
    onError: (e: any) => toast.error(e.message),
  });
  const dobM = useMutation({
    mutationFn: () => saveDob({ data: { dob: dob || null, anniversary: anniv || null } }),
    onSuccess: () => toast.success("Saved — we'll send you a special coupon on the day 🎂"),
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <div className="container-page py-10 text-muted-foreground">Loading your rewards…</div>;
  }

  const { account, transactions, referralCode, referrals } = data;
  const nextMilestone = account.current_streak < 7 ? 7 : account.current_streak < 30 ? 30 : 100;
  const milestoneProgress = Math.min(100, Math.round((account.current_streak / nextMilestone) * 100));

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="container-page py-8 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Rewards & Coins</h1>
        <p className="text-muted-foreground mt-1">Earn coins on every order. Share the love, build your streak.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-primary/5 p-5">
          <div className="flex items-center gap-2 text-primary"><Coins className="h-5 w-5" /><span className="text-sm font-medium">Coin balance</span></div>
          <div className="mt-2 text-4xl font-display font-semibold">{account.coins_balance}</div>
          <div className="mt-1 text-xs text-muted-foreground">Lifetime: {account.lifetime_coins} • ₹1 per coin</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 text-orange-500"><Flame className="h-5 w-5" /><span className="text-sm font-medium">Order streak</span></div>
          <div className="mt-2 text-4xl font-display font-semibold">{account.current_streak} <span className="text-base text-muted-foreground">days</span></div>
          <div className="mt-3">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-orange-500 transition-all" style={{ width: `${milestoneProgress}%` }} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Next reward at {nextMilestone}-day streak</div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 text-emerald-600"><Gift className="h-5 w-5" /><span className="text-sm font-medium">Total orders</span></div>
          <div className="mt-2 text-4xl font-display font-semibold">{account.total_orders}</div>
          <div className="mt-1 text-xs text-muted-foreground">Longest streak: {account.longest_streak} days</div>
        </div>
      </div>

      {/* Redeem */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-3"><Sparkles className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Redeem coins for a coupon</h2></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {REDEEM_TIERS.map((t) => (
            <button
              key={t}
              disabled={account.coins_balance < t || redeemM.isPending}
              onClick={() => redeemM.mutate(t)}
              className="rounded-xl border border-border p-4 text-left hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <div className="text-sm text-muted-foreground">Spend</div>
              <div className="text-xl font-semibold">{t} coins</div>
              <div className="mt-1 text-sm text-primary">Get ₹{t} off</div>
            </button>
          ))}
        </div>
        {lastCoupon && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            Coupon <strong>{lastCoupon.code}</strong> for ₹{lastCoupon.discount} off — use at checkout.
          </div>
        )}
      </section>

      {/* Referrals */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-3"><Share2 className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Invite friends — earn 200 coins each</h2></div>
        {referralCode ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-border bg-background px-4 py-3 font-mono text-lg">{referralCode}</div>
            <Button variant="outline" onClick={() => copy(referralCode)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <Button onClick={() => genM.mutate()} disabled={genM.isPending}>Generate my code</Button>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Share your code. When a friend places their first order, you get 200 coins and they get 100.
        </p>
        <div className="mt-4">
          <div className="text-sm font-medium mb-1">Got a code from a friend?</div>
          <div className="flex gap-2">
            <Input value={refInput} onChange={(e) => setRefInput(e.target.value)} placeholder="NEST123ABC" className="font-mono" />
            <Button variant="outline" onClick={() => applyM.mutate(refInput)} disabled={!refInput || applyM.isPending}>Apply</Button>
          </div>
        </div>
        {referrals.length > 0 && (
          <div className="mt-4 text-sm">
            <div className="text-muted-foreground">Your referrals: {referrals.length}</div>
          </div>
        )}
      </section>

      {/* Birthday */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-3"><Cake className="h-5 w-5 text-pink-500" /><h2 className="text-lg font-semibold">Birthday & anniversary surprises</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Date of birth</Label>
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div>
            <Label>Anniversary (optional)</Label>
            <Input type="date" value={anniv} onChange={(e) => setAnniv(e.target.value)} />
          </div>
        </div>
        <Button className="mt-3" onClick={() => dobM.mutate()} disabled={dobM.isPending}>Save</Button>
      </section>

      {/* Transactions */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold mb-3">Recent activity</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No coin activity yet — place your first order to start earning.</p>
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map((t: any) => (
              <li key={t.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{t.description ?? t.kind}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div className={t.delta >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                  {t.delta >= 0 ? "+" : ""}{t.delta}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}