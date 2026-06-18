import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — MealNest" },
      { name: "description", content: "How MealNest collects, uses, and protects your personal information." },
      { property: "og:title", content: "Privacy Policy — MealNest" },
      { property: "og:url", content: "/privacy" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
});

function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />
      <main className="container-page flex-1 py-12">
        <article className="prose mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-semibold">Privacy Policy</h1>
          <p className="mt-2 text-muted-foreground">Last updated: June 2026</p>

          <h2 className="mt-8 font-display text-2xl font-semibold">Information we collect</h2>
          <p className="mt-2 text-muted-foreground">Account details (name, email, phone), delivery addresses, order history, payment metadata, and device information necessary to operate the service.</p>

          <h2 className="mt-6 font-display text-2xl font-semibold">How we use it</h2>
          <p className="mt-2 text-muted-foreground">To fulfil your orders, route deliveries, prevent fraud, send transactional notifications, and improve our menus and matching.</p>

          <h2 className="mt-6 font-display text-2xl font-semibold">Sharing</h2>
          <p className="mt-2 text-muted-foreground">We share order details with the home chef preparing your food and the delivery partner assigned to your order. We do not sell your data.</p>

          <h2 className="mt-6 font-display text-2xl font-semibold">Your rights</h2>
          <p className="mt-2 text-muted-foreground">You can request export or deletion of your account data at any time by contacting support@mealnest.app.</p>

          <h2 className="mt-6 font-display text-2xl font-semibold">Security</h2>
          <p className="mt-2 text-muted-foreground">Data is stored on managed infrastructure with encryption in transit and at rest. Access is restricted via row-level security policies.</p>

          <h2 className="mt-6 font-display text-2xl font-semibold">Contact</h2>
          <p className="mt-2 text-muted-foreground">Questions? Email support@mealnest.app.</p>
        </article>
      </main>
      <Footer />
    </div>
  );
}
