import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAuditLog } from "@/lib/rewards-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/rewards/audit")({
  component: AuditLog,
});

function AuditLog() {
  const fetch = useServerFn(getAuditLog);
  const { data, isLoading } = useQuery({ queryKey: ["rew-audit"], queryFn: () => fetch() });
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground border-b border-border">
          <tr>
            <th className="p-3">When</th><th className="p-3">Admin</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Diff</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? <tr><td className="p-3" colSpan={5}>Loading…</td></tr> :
            (data ?? []).map((e: any) => (
              <tr key={e.id} className="border-b border-border last:border-0 align-top">
                <td className="p-3 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                <td className="p-3">{e.admin_name}</td>
                <td className="p-3"><span className="rounded bg-muted px-2 py-0.5 text-xs">{e.action}</span></td>
                <td className="p-3">{e.entity_type}</td>
                <td className="p-3">
                  <details>
                    <summary className="cursor-pointer text-xs text-primary">View</summary>
                    <pre className="mt-2 max-w-xl text-xs whitespace-pre-wrap text-muted-foreground">
{`PREV: ${JSON.stringify(e.previous_value ?? {}, null, 2)}
NEW : ${JSON.stringify(e.new_value ?? {}, null, 2)}`}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
