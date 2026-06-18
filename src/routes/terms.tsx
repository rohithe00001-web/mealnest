import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — MealNest" },
      { name: "description", content: "The terms that govern your use of MealNest." },
      { property: "og:title", content: "Terms of Service — MealNest" },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
});

function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />
      <main className="container-page flex-1 py-12">
        <article className="prose mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-semibold">Terms of Service</h1>
          <p className="mt-2 text-muted-foreground">Last updated: June 2026</p>

          <h2 className="mt-8 font-display text-2xl font-semibold">Using MealNest</h2>
          <p className="mt-2 text-muted-foreground">You must be 18+ to place orders. You agree to provide accurate delivery information and to pay for orders you place.</p>

          <h2 className="mt-6 font-display text-2xl font-semibold">Home chefs</h2>
          <p className="mt-2 text-muted-foreground">Cooks selling on MealNest are independent operators. They are responsible for food quality, hygiene, and compliance with local food-safety regulations (including FSSAI registration where required).</p>

          <h2 className="mt-6 font-display text-2xl font-semibold">Cancellations & refunds</h2>
          <p className="mt-2 text-muted-foreground">Orders can be cancelled until the kitchen accepts them. Refunds for quality issues are reviewed case by case.</p>

          <h2 className="mt-6 font-display text-2xl font-semibold">Acceptable use</h2>
          <p className="mt-2 text-muted-foreground">No fraudulent orders, abuse of referral / loyalty systems, harassment of cooks or delivery partners, or attempts to interfere with the service.</p>

          <h2 className="mt-6 font-display text-2xl font-semibold">Liability</h2>
          <p className="mt-2 text-muted-foreground">MealNest is a marketplace. Our liability for any order is limited to the order total.</p>

          <h2 className="mt-6 font-display text-2xl font-semibold">Contact</h2>
          <p className="mt-2 text-muted-foreground">Questions? Email support@mealnest.app.</p>
        </article>
      </main>
      <Footer />
    </div>
  );
}
