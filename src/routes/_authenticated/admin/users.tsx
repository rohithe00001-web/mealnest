import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, ShieldCheck, ShieldOff, Ban, RotateCcw } from "lucide-react";
import { listAdminUsers, toggleUserBlocked, setUserRole } from "@/lib/admin.functions";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [search, setSearch] = useState("");
  const listFn = useServerFn(listAdminUsers);
  const blockFn = useServerFn(toggleUserBlocked);
  const roleFn = useServerFn(setUserRole);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listFn(),
  });
  const blockMut = useMutation({
    mutationFn: (v: { userId: string; blocked: boolean }) => blockFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "seller" | "customer"; grant: boolean }) =>
      roleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return (data as any[]).filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, phone"
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="rounded-xl border border-border bg-surface">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No users found.</p>
        ) : (
          <div className="divide-y divide-border">
            {(filtered as any[]).map((u) => {
              const isAdmin = u.roles.includes("admin");
              return (
                <div key={u.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{u.full_name ?? "—"}</p>
                      {u.is_blocked && (
                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] text-destructive">
                          Blocked
                        </span>
                      )}
                      {u.roles.map((r: string) => (
                        <span
                          key={r}
                          className={`rounded-full px-2 py-0.5 text-[11px] capitalize ${
                            r === "admin"
                              ? "bg-primary/15 text-primary"
                              : r === "seller"
                                ? "bg-accent/30 text-accent-foreground"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {u.email ?? "—"} · {u.phone ?? "no phone"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(u.created_at).toLocaleDateString()} · {u.order_count} orders ·{" "}
                      {inr(Number(u.total_spend))} spent
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={roleMut.isPending}
                      onClick={() => roleMut.mutate({ userId: u.id, role: "admin", grant: !isAdmin })}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      {isAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      {isAdmin ? "Remove admin" : "Make admin"}
                    </button>
                    {u.is_blocked ? (
                      <button
                        disabled={blockMut.isPending}
                        onClick={() => blockMut.mutate({ userId: u.id, blocked: false })}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Unblock
                      </button>
                    ) : (
                      <button
                        disabled={blockMut.isPending}
                        onClick={() => blockMut.mutate({ userId: u.id, blocked: true })}
                        className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        <Ban className="h-3.5 w-3.5" /> Block
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
