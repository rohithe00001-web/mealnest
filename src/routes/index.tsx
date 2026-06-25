import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DishCard } from "@/components/DishCard";
import { CampaignBanners } from "@/components/CampaignBanners";
import { SellerCard } from "@/components/SellerCard";
import { categoriesQuery, dishesQuery, sellersQuery } from "@/lib/queries";
import { ArrowRight, MapPin, Sun, Utensils, Moon, Cookie, Coffee, Cake, Search as SearchIcon, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import heroImg from "@/assets/hero-thali.jpg";

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  breakfast: Sun, lunch: Utensils, dinner: Moon, snacks: Cookie, beverages: Coffee, desserts: Cake,
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MealNest — Homemade meals from neighborhood kitchens" },
      { name: "description", content: "Order fresh, home-cooked meals from real cooks in your area. Browse dishes by cuisine, veg/non-veg, and rating. Delivered in under an hour." },
      { property: "og:title", content: "MealNest — Homemade meals, delivered" },
      { property: "og:description", content: "Real cooks in your neighborhood, real food, delivered to your door." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(categoriesQuery);
    void context.queryClient.prefetchQuery(dishesQuery());
    void context.queryClient.prefetchQuery(sellersQuery);
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <MobileGreeting />
        <Hero />
        <CampaignBanners />
        <Suspense fallback={<SectionSkeleton />}>
          <Kitchens />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <Categories />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <PopularDishes />
        </Suspense>
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
}

function MobileGreeting() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState("Hello");
  const [location, setLocation] = useState<string>("Set delivery address");

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Good night");
    try {
      const saved = localStorage.getItem("mn:last-address-label");
      if (saved) setLocation(saved);
    } catch {/* noop */}
  }, []);

  const name = (user?.user_metadata?.full_name as string)?.split(" ")?.[0] || user?.email?.split("@")[0] || "there";

  return (
    <section className="lg:hidden px-4 pt-4 pb-2 bg-gradient-to-b from-primary/5 to-transparent">
      <Link to="/addresses" className="flex items-center gap-2 text-left active:opacity-70">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
          <MapPin className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deliver to</p>
          <p className="truncate text-sm font-medium inline-flex items-center gap-1">
            {location} <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{greeting}</p>
          <p className="truncate text-sm font-semibold capitalize">{name} 👋</p>
        </div>
      </Link>
      <button
        onClick={() => navigate({ to: "/browse" })}
        className="mt-3 flex w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground shadow-soft active:scale-[0.98] transition-transform"
      >
        <SearchIcon className="h-4 w-4" />
        Search dishes, kitchens, cuisines…
      </button>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Pick a dish", body: "Browse fresh menus from real cooks near you." },
    { n: "02", title: "Order in seconds", body: "Cash on delivery, no subscriptions, no fuss." },
    { n: "03", title: "Eat homemade", body: "Hot food at your door, usually within the hour." },
  ];
  return (
    <section className="container-page py-10 border-t border-border/60">
      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="flex gap-4">
            <span className="font-display text-3xl text-primary/70 leading-none">{s.n}</span>
            <div>
              <h3 className="font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="container-page pt-10 pb-16 md:pt-16 md:pb-24">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <MapPin className="h-3 w-3" /> Neighborhood kitchens
          </span>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            Homemade meals,<br />
            <span className="italic text-primary">delivered.</span>
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground sm:text-lg">
            Real cooks in your area making food the way your family does. Order today, eat in an hour.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/browse" className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Browse dishes <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/become-seller" className="inline-flex h-12 items-center rounded-full border border-border bg-surface px-6 text-sm font-medium hover:bg-muted transition-colors">
              Start a home kitchen
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="relative aspect-[5/4] overflow-hidden rounded-3xl bg-secondary shadow-[var(--shadow-card)]">
            <img src={heroImg} alt="Homemade Indian thali" className="h-full w-full object-cover" width={1600} height={1200} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Categories() {
  const { data: cats } = useSuspenseQuery(categoriesQuery);
  return (
    <section className="container-page py-10">
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">What are you craving?</h2>
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {cats.map((c) => {
          const Icon = categoryIcons[c.slug] ?? Utensils;
          return (
            <Link
              key={c.id}
              to="/browse"
              search={{ category: c.slug }}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium">{c.name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function PopularDishes() {
  const { data: dishes } = useSuspenseQuery(dishesQuery());
  return (
    <section className="container-page py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Popular today</h2>
          <p className="text-sm text-muted-foreground mt-1">Fresh from kitchens near you</p>
        </div>
        <Link to="/browse" className="text-sm font-medium text-primary hover:underline">See all</Link>
      </div>
      {dishes.length === 0 ? (
        <EmptyKitchens />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {dishes.slice(0, 8).map((d: any) => <DishCard key={d.id} dish={d} />)}
        </div>
      )}
    </section>
  );
}

function Kitchens() {
  const { data: sellers } = useSuspenseQuery(sellersQuery);
  const [tab, setTab] = useState<"all" | "open" | "top" | "new">("all");
  const filtered = sellers
    .filter((s: any) => {
      if (tab === "open") return s.is_open;
      if (tab === "top") return Number(s.rating_avg ?? 0) >= 4;
      return true;
    })
    .slice(0, tab === "new" ? 12 : 60)
    .sort((a: any, b: any) => {
      if (tab === "new") return 0;
      if (tab === "top") return Number(b.rating_avg ?? 0) - Number(a.rating_avg ?? 0);
      return 0;
    });

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "all", label: "All kitchens" },
    { key: "open", label: "Open now" },
    { key: "top", label: "Top rated" },
    { key: "new", label: "Recently added" },
  ];

  return (
    <section id="kitchens" className="container-page py-10 scroll-mt-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Kitchens near you</h2>
          <p className="mt-1 text-sm text-muted-foreground">Browse home cooks by their storefront.</p>
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {sellers.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No kitchens yet — be the first to{" "}
          <Link to="/become-seller" className="text-primary underline">open one</Link>.
        </p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s: any) => (
            <SellerCard key={s.id} seller={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyKitchens() {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
      <h3 className="font-display text-xl font-semibold">No dishes available yet</h3>
      <p className="mt-2 text-sm text-muted-foreground">MealNest is opening in your area. Be the first cook to join.</p>
      <Link to="/become-seller" className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Open your kitchen
      </Link>
    </div>
  );
}

function SectionSkeleton() {
  return <div className="container-page py-10"><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div>;
}
