import { Link, useRouterState } from "@tanstack/react-router";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface RoleNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface Props {
  items: RoleNavItem[];
  /** Number of items to surface directly in the bottom bar (rest go into More). */
  primaryCount?: number;
  label?: string;
}

export function RoleMobileNav({ items, primaryCount = 4, label = "Menu" }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const isActive = (it: RoleNavItem) => (it.exact ? pathname === it.to : pathname.startsWith(it.to));

  // Promote the currently-active item into the primary slots if it's hidden.
  const activeIndex = items.findIndex(isActive);
  let primary = items.slice(0, primaryCount);
  let overflow = items.slice(primaryCount);
  if (activeIndex >= primaryCount) {
    primary = [...items.slice(0, primaryCount - 1), items[activeIndex]];
    overflow = items.filter((_, i) => i !== activeIndex && i >= primaryCount - 1);
  }
  const hasOverflow = overflow.length > 0;
  const cols = primary.length + (hasOverflow ? 1 : 0);

  return (
    <nav
      aria-label={label}
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[max(env(safe-area-inset-bottom),0px)]"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {primary.map((it) => {
          const active = isActive(it);
          const Icon = it.icon;
          return (
            <li key={it.to} className="flex">
              <Link
                to={it.to}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-14"
              >
                {active && <span aria-hidden className="absolute -top-px h-1 w-10 rounded-b-full bg-primary" />}
                <span className={cn("grid h-8 w-8 place-items-center rounded-full transition-all", active ? "bg-primary/10 text-primary scale-110" : "text-muted-foreground")}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={cn("text-[10px] font-medium leading-none truncate max-w-[64px]", active ? "text-primary" : "text-muted-foreground")}>{it.label}</span>
              </Link>
            </li>
          );
        })}
        {hasOverflow && (
          <li className="flex">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-14">
                  <span className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground">
                    <MoreHorizontal className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-[10px] font-medium leading-none text-muted-foreground">More</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>{label}</SheetTitle>
                </SheetHeader>
                <ul className="mt-4 grid grid-cols-3 gap-2 pb-[max(env(safe-area-inset-bottom),0px)]">
                  {overflow.map((it) => {
                    const Icon = it.icon;
                    const active = isActive(it);
                    return (
                      <li key={it.to}>
                        <Link
                          to={it.to}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-center transition-colors active:scale-[0.97]",
                            active && "border-primary/50 bg-primary/5",
                          )}
                        >
                          <span className={cn("grid h-10 w-10 place-items-center rounded-xl", active ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground")}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="text-xs font-medium leading-tight">{it.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </SheetContent>
            </Sheet>
          </li>
        )}
      </ul>
    </nav>
  );
}

export function RoleMobileNavSpacer() {
  return (
    <div
      aria-hidden
      className="lg:hidden"
      style={{ height: "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)" }}
    />
  );
}
