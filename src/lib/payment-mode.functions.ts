import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Public read of the current online-payments toggle.
 * Uses the publishable client so it works during SSR / for signed-out visitors.
 */
export const getPaymentMode = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await sb.rpc("get_online_payments_enabled");
  if (error) {
    // Fail closed: assume online payments are off if we can't reach the toggle.
    return { onlinePaymentsEnabled: false };
  }
  return { onlinePaymentsEnabled: Boolean(data) };
});

const SetPaymentModeInput = z.object({ enabled: z.boolean() });

export const setPaymentMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetPaymentModeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { data: result, error } = await context.supabase.rpc("set_online_payments_enabled", {
      _enabled: data.enabled,
    });
    if (error) throw new Error(error.message);
    return { onlinePaymentsEnabled: Boolean(result) };
  });
