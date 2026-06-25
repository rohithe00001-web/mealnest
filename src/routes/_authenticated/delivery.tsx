import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Truck, ClipboardList, User as UserIcon } from "lucide-react";
import { RoleMobileNav, RoleMobileNavSpacer } from "@/components/RoleMobileNav";

const NAV = [
  { to: "/delivery", label: "Assignments", icon: Truck, exact: true },
  { to: "/delivery/register", label: "Register", icon: ClipboardList },
  { to: "/profile", label: "Profile", icon: UserIcon },
];

export const Route = createFileRoute("/_authenticated/delivery")({
  component: DeliveryLayout,
});

function DeliveryLayout() {
  return (
    <>
      <Outlet />
      <RoleMobileNavSpacer />
      <RoleMobileNav items={NAV} label="Delivery menu" />
    </>
  );
}
