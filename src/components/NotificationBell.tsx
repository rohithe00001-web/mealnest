import { Bell, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useNotifications } from "@/lib/notifications";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

function timeAgo(ts: number) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const { items, unread, markAllRead, clear } = useNotifications();
  return (
    <DropdownMenu onOpenChange={(open) => { if (open && unread > 0) setTimeout(markAllRead, 600); }}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface hover:bg-muted transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {items.length > 0 && (
            <button onClick={clear} className="text-xs font-normal text-muted-foreground hover:text-foreground">
              Clear
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">You're all caught up.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {items.map((n) => {
              const inner = (
                <div className="flex items-start gap-2 px-3 py-2.5 hover:bg-muted">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-muted-foreground/30" : "bg-primary"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {n.read && <Check className="h-3 w-3 text-muted-foreground/60 mt-1" />}
                </div>
              );
              return (
                <li key={n.id}>
                  {n.href ? <Link to={n.href as any}>{inner}</Link> : inner}
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
