import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-surface mt-20">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <h4 className="font-display text-lg font-semibold">MealNest</h4>
          <p className="mt-2 text-sm text-muted-foreground">
            Homemade Goodness, Delivered Daily. Fresh meals from trusted home chefs in your neighborhood.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-medium mb-2">Eat</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><Link to="/browse" className="hover:text-foreground">Browse dishes</Link></li>
            <li><Link to="/" hash="kitchens" className="hover:text-foreground">Nearby kitchens</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-medium mb-2">Cook</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><Link to="/become-seller" className="hover:text-foreground">Become a seller</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-medium mb-2">Account</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><Link to="/orders" className="hover:text-foreground">My orders</Link></li>
            <li><Link to="/auth" className="hover:text-foreground">Sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="container-page py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} MealNest</span>
          <nav className="flex gap-4">
            <Link to="/trust" className="hover:text-foreground">Trust &amp; Safety</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
