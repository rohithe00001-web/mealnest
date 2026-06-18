import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PHONE_DOMAIN = "phone.mealnest.local";

function normalize(countryCode: string, phone: string) {
  const cc = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;
  const digits = phone.replace(/\D/g, "");
  return { cc, digits, e164: `${cc}${digits}` };
}

function syntheticEmail(e164: string) {
  // strip + for local-part
  return `${e164.replace("+", "")}@${PHONE_DOMAIN}`;
}

async function hashCode(code: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${code}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const sendSchema = z.object({
  countryCode: z.string().min(2).max(5),
  phone: z.string().min(6).max(15),
  channel: z.enum(["sms", "whatsapp"]).optional().default("sms"),
});

export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sendSchema.parse(input))
  .handler(async ({ data }) => {
    const { cc, digits, e164 } = normalize(data.countryCode, data.phone);
    if (digits.length < 6) return { ok: false, reason: "Invalid phone number" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Rate limit: max 3 sends per 10 min, 8 per hour
    const since10m = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [{ count: c10 }, { count: c60 }] = await Promise.all([
      supabaseAdmin.from("otp_send_log").select("id", { count: "exact", head: true }).eq("phone_e164", e164).gte("created_at", since10m),
      supabaseAdmin.from("otp_send_log").select("id", { count: "exact", head: true }).eq("phone_e164", e164).gte("created_at", sinceHour),
    ]);
    if ((c10 ?? 0) >= 3 || (c60 ?? 0) >= 8) {
      await supabaseAdmin.from("otp_send_log").insert({ phone_e164: e164, channel: data.channel, success: false, reason: "rate_limited" });
      return { ok: false, reason: "Too many attempts. Try again later." };
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await hashCode(code, e164);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await supabaseAdmin.from("otp_codes").insert({
      phone_e164: e164, code_hash: codeHash, purpose: "login", expires_at: expiresAt,
    });
    await supabaseAdmin.from("otp_send_log").insert({ phone_e164: e164, channel: data.channel, success: true });

    // ---- SMS dispatch ----
    // TODO: replace this stub with the Twilio gateway call once the connector is linked.
    // The dev_code is only returned outside production so testers can complete the flow.
    const isProd = process.env.NODE_ENV === "production";
    console.log(`[OTP] ${e164} via ${data.channel}: ${code} (valid 5 min)`);
    return {
      ok: true,
      phone_e164: e164,
      country_code: cc,
      expires_in: 300,
      dev_code: isProd ? undefined : code,
    };
  });

const verifySchema = z.object({
  countryCode: z.string().min(2).max(5),
  phone: z.string().min(6).max(15),
  code: z.string().regex(/^\d{6}$/),
  role: z.enum(["customer", "seller", "delivery_agent", "admin"]).optional(),
  fullName: z.string().min(1).max(100).optional(),
});

export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data }) => {
    const { cc, digits, e164 } = normalize(data.countryCode, data.phone);
    if (digits.length < 6) return { ok: false, reason: "Invalid phone number" } as const;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get most recent unconsumed OTP for this phone
    const { data: row, error } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("phone_e164", e164)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !row) return { ok: false, reason: "No OTP requested. Please resend." } as const;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false, reason: "OTP expired. Please resend." } as const;
    }
    if (row.attempts >= row.max_attempts) {
      return { ok: false, reason: "Too many incorrect attempts. Please resend." } as const;
    }

    const candidateHash = await hashCode(data.code, e164);
    if (candidateHash !== row.code_hash) {
      await supabaseAdmin.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return { ok: false, reason: "Incorrect code." } as const;
    }

    await supabaseAdmin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);

    // Find or create the auth user (synthetic email backed by phone)
    const email = syntheticEmail(e164);
    let userId: string | null = null;

    // Try fetch by email
    {
      // listUsers doesn't filter by email server-side reliably; use getUserByEmail via REST
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = existing?.users.find((u) => u.email === email);
      userId = match?.id ?? null;
    }

    if (!userId) {
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: data.fullName ?? null,
          phone_e164: e164,
          country_code: cc,
          login_method: "phone_otp",
        },
      });
      if (cErr || !created.user) return { ok: false, reason: cErr?.message ?? "Could not create account" } as const;
      userId = created.user.id;
    }

    // Upsert profile fields
    await supabaseAdmin.from("profiles").update({
      phone: digits,
      country_code: cc,
      phone_verified: true,
      login_method: "phone_otp",
      last_login_at: new Date().toISOString(),
      ...(data.fullName ? { full_name: data.fullName } : {}),
    }).eq("id", userId);

    // Assign role (idempotent). Admins cannot be self-assigned.
    const requestedRole = data.role && data.role !== "admin" ? data.role : null;
    if (requestedRole) {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: requestedRole },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    }

    // Issue a magiclink token the client can exchange for a session
    const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (lErr || !link.properties?.hashed_token) {
      return { ok: false, reason: lErr?.message ?? "Could not start session" } as const;
    }

    return {
      ok: true,
      user_id: userId,
      email,
      token_hash: link.properties.hashed_token,
    } as const;
  });