import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) {
    throw new Error("Forbidden: administrator only");
  }
}

function maskEmail(email: string | null | undefined): string | undefined {
  if (!email) return undefined;
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

export const getFinanceEmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { getEmailDeliveryStatus } = await import("@/lib/email.server");
    return getEmailDeliveryStatus();
  });

export const sendFinanceTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        toEmail: z.string().email().max(150).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { getEmailDeliveryStatus, sendEmail } = await import("@/lib/email.server");
    const status = getEmailDeliveryStatus();
    if (!status.configured) {
      throw new Error(
        "Email delivery is not configured yet. Add SMTP (Outlook) or Resend variables in Vercel Environment Variables and redeploy.",
      );
    }

    let recipient = data.toEmail?.trim().toLowerCase();
    if (!recipient) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: sec } = await supabaseAdmin
        .from("finance_security")
        .select("recovery_email")
        .eq("id", "global")
        .maybeSingle();
      recipient = sec?.recovery_email ?? undefined;
    }
    if (!recipient) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      recipient = userRes.user?.email ?? undefined;
    }
    if (!recipient) {
      throw new Error("Enter a recipient email address or set a Finance Recovery Email first.");
    }

    await sendEmail({
      to: recipient,
      subject: "CGCC Cafeteria Express — Test Security Email",
      text: `This is a test email from CGCC Cafeteria Express confirming your 2FA email delivery (${status.provider?.toUpperCase()}) is working properly.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="margin:0 0 12px;color:#111827;">CGCC Cafeteria Express</h2>
          <p style="margin:0 0 12px;color:#374151;">Your security email delivery is working properly.</p>
          <p style="margin:0;color:#6b7280;font-size:13px;">Provider: <strong>${status.provider?.toUpperCase()}</strong> · Sender: ${status.fromLabel}</p>
        </div>
      `,
    });

    return { ok: true, sentTo: recipient, provider: status.provider };
  });

export const financeUnlockServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        pin: z.string().min(4).max(20),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);

    const { data: raw, error } = await context.supabase.rpc("finance_unlock", {
      _pin: data.pin,
    });
    if (error) throw error;

    const res = raw as {
      ok: boolean;
      session_id?: string;
      needs_otp?: boolean;
      otp_code?: string;
      recovery_email?: string;
      locked_until?: string;
      attempts_left?: number;
    };

    if (!res.ok) {
      return {
        ok: false,
        locked_until: res.locked_until,
        attempts_left: res.attempts_left,
      };
    }

    if (!res.needs_otp) {
      return {
        ok: true,
        session_id: res.session_id,
        needs_otp: false,
      };
    }

    // Tight 2FA: NEVER expose otp_code to the browser. Always deliver via real email.
    const { getEmailDeliveryStatus, sendEmail } = await import("@/lib/email.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emailStatus = getEmailDeliveryStatus();

    const revokePendingSession = async () => {
      if (!res.session_id) return;
      await supabaseAdmin
        .from("finance_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", res.session_id);
    };

    if (!emailStatus.configured) {
      await revokePendingSession();
      return {
        ok: false,
        email_not_configured: true,
        error:
          "Email delivery is not configured on the server yet. Add your Outlook SMTP or Resend environment variables in Vercel so OTP codes are sent to your inbox.",
      };
    }

    if (!res.recovery_email || !res.otp_code) {
      await revokePendingSession();
      return {
        ok: false,
        error: "Finance recovery email is missing. Set a valid recovery email in Finance Security.",
      };
    }

    try {
      await sendEmail({
        to: res.recovery_email,
        subject: "CGCC Cafeteria Express — Your Finance Security Code",
        text: `Your one-time finance verification code is: ${res.otp_code}\n\nThis code expires in 10 minutes. If you did not request this, sign out all finance sessions immediately.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
            <h2 style="margin:0 0 8px;color:#111827;">CGCC Cafeteria Express</h2>
            <p style="margin:0 0 16px;color:#374151;">Use the one-time verification code below to unlock Finance &amp; Payment:</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center;font-size:28px;font-weight:700;letter-spacing:6px;color:#111827;font-family:monospace;">
              ${res.otp_code}
            </div>
            <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">This code expires in 10 minutes. Never share it with anyone.</p>
          </div>
        `,
      });
    } catch (err) {
      await revokePendingSession();
      return {
        ok: false,
        error:
          err instanceof Error
            ? `Could not send verification email: ${err.message}`
            : "Could not send verification email.",
      };
    }

    return {
      ok: true,
      session_id: res.session_id,
      needs_otp: true,
      email_sent: true,
      recovery_email: maskEmail(res.recovery_email),
    };
  });
