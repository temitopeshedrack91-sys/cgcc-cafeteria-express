// Server-only email delivery helper (SMTP / Outlook / Resend).
// Never import this file from client bundles; import dynamically inside createServerFn handlers.

export type EmailDeliveryStatus = {
  configured: boolean;
  provider: "smtp" | "resend" | null;
  fromLabel: string | null;
};

function cleanEnv(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function formatSmtpError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/SmtpClientAuthentication|5\.7\.139|basic authentication is disabled/i.test(msg)) {
    return "Outlook/Microsoft 365 blocked SMTP login (Basic Auth / Authenticated SMTP is disabled on that account). Switch to a Gmail App Password (smtp.gmail.com) or Resend (RESEND_API_KEY) in Vercel.";
  }
  if (/5\.7\.8|Username and Password not accepted|Invalid login/i.test(msg)) {
    return "Email login was rejected. For Gmail or Outlook, you must use an App Password (not your regular email password) in SMTP_PASS.";
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) {
    return `Could not reach the mail server (${msg}). Check SMTP_HOST and SMTP_PORT (usually 587).`;
  }
  return msg;
}

export function getEmailDeliveryStatus(): EmailDeliveryStatus {
  const smtpHost = cleanEnv(process.env.SMTP_HOST);
  const smtpUser = cleanEnv(process.env.SMTP_USER);
  const smtpPass = cleanEnv(process.env.SMTP_PASS);
  if (smtpHost && smtpUser && smtpPass) {
    return {
      configured: true,
      provider: "smtp",
      fromLabel: cleanEnv(process.env.SMTP_FROM) || smtpUser,
    };
  }

  const resendKey = cleanEnv(process.env.RESEND_API_KEY);
  if (resendKey) {
    return {
      configured: true,
      provider: "resend",
      fromLabel:
        cleanEnv(process.env.MAIL_FROM) ||
        cleanEnv(process.env.RESEND_FROM) ||
        "CGCC Cafeteria Express <onboarding@resend.dev>",
    };
  }

  return {
    configured: false,
    provider: null,
    fromLabel: null,
  };
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const status = getEmailDeliveryStatus();
  if (!status.configured || !status.provider) {
    throw new Error(
      "Email delivery is not configured on the server yet. Add SMTP (Gmail/Outlook) or Resend environment variables in Vercel and redeploy.",
    );
  }

  if (status.provider === "smtp") {
    const mod = (await import("nodemailer")) as unknown as {
      createTransport?: typeof import("nodemailer").createTransport;
      default?: { createTransport?: typeof import("nodemailer").createTransport };
    };
    const createTransport = mod.createTransport ?? mod.default?.createTransport;
    if (!createTransport) {
      throw new Error(
        "SMTP mailer is unavailable in this server runtime. Use Resend (RESEND_API_KEY) instead.",
      );
    }

    const host = cleanEnv(process.env.SMTP_HOST);
    const port = Number(cleanEnv(process.env.SMTP_PORT) || "587") || 587;
    const secureFlag = cleanEnv(process.env.SMTP_SECURE);
    const secure = secureFlag === "true" || secureFlag === "1" || port === 465;

    const transporter = createTransport({
      host,
      port,
      secure,
      auth: {
        user: cleanEnv(process.env.SMTP_USER),
        pass: cleanEnv(process.env.SMTP_PASS),
      },
      tls: {
        minVersion: "TLSv1.2",
      },
    });

    try {
      await transporter.sendMail({
        from: status.fromLabel!,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    } catch (err) {
      throw new Error(formatSmtpError(err));
    }
    return { provider: "smtp" as const };
  }

  // Resend API
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cleanEnv(process.env.RESEND_API_KEY)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: status.fromLabel!,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email provider rejected delivery (${res.status}): ${detail || res.statusText}`);
  }

  return { provider: "resend" as const };
}
