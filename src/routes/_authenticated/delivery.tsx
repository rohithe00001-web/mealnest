import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/_authenticated/delivery")({
  component: () => (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="container-page flex-1 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Delivery Agent</p>
            <h1 className="font-display text-3xl font-semibold">My deliveries</h1>
          </div>
          <Link to="/delivery/register" className="text-sm font-medium text-primary hover:underline">Manage application</Link>
        </div>
        <Outlet />
      </div>
    </div>
  ),
});
