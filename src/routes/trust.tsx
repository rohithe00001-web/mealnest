import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ShieldCheck, Lock, UserCheck, Utensils } from "lucide-react";

export const Route = createFileRoute("/trust")({
  component: TrustPage,
  head: () => ({
    meta: [
      { title: "Trust & Safety — MealNest" },
      { name: "description", content: "How MealNest keeps your food, your data, and your payments safe." },
      { property: "og:title", content: "Trust & Safety — MealNest" },
      { property: "og:url", content: "/trust" },
    ],
    links: [{ rel: "canonical", href: "/trust" }],
  }),
});

const PILLARS = [
  { icon: Utensils, title: "Verified kitchens", body: "Every home chef is reviewed before going live. FSSAI registration and ID checks are required where applicable." },
  { icon: ShieldCheck, title: "Hygiene standards", body: "Kitchens commit to our food-safety checklist. Repeated quality issues are grounds for removal." },
  { icon: Lock, title: "Your data, encrypted", body: "Data is encrypted in transit and at rest. Row-level security ensures only you can read your own orders and addresses." },
  { icon: UserCheck, title: "Background-checked delivery", body: "Delivery partners go through ID and background verification before they accept orders." },
];

function TrustPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />
      <main className="container-page flex-1 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">Trust &amp; Safety at MealNest</h1>
          <p className="mt-3 text-muted-foreground">Real cooks, real food, handled with care from kitchen to door.</p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-3xl bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
          <p>Report a safety concern or quality issue at <a className="text-primary underline" href="mailto:safety@mealnest.app">safety@mealnest.app</a>. We respond within one business day.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
