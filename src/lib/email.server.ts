// Server-only email delivery helper (SMTP / Outlook / Resend).
// Never import this file from client bundles; import dynamically inside createServerFn handlers.

export type EmailDeliveryStatus = {
  configured: boolean;
  provider: "smtp" | "resend" | null;
  fromLabel: string | null;
};

export function getEmailDeliveryStatus(): EmailDeliveryStatus {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  if (smtpHost && smtpUser && smtpPass) {
    return {
      configured: true,
      provider: "smtp",
      fromLabel: process.env.SMTP_FROM?.trim() || smtpUser,
    };
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    return {
      configured: true,
      provider: "resend",
      fromLabel:
        process.env.MAIL_FROM?.trim() ||
        process.env.RESEND_FROM?.trim() ||
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
      "Email delivery is not configured on the server yet. Add SMTP (Outlook) or Resend environment variables in Vercel and redeploy.",
    );
  }

  if (status.provider === "smtp") {
    const nodemailer = await import("nodemailer");
    const host = process.env.SMTP_HOST!.trim();
    const port = Number(process.env.SMTP_PORT || "587") || 587;
    const secure =
      process.env.SMTP_SECURE === "true" ||
      process.env.SMTP_SECURE === "1" ||
      port === 465;

    const transporter = nodemailer.default.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER!.trim(),
        pass: process.env.SMTP_PASS!.trim(),
      },
      tls: {
        minVersion: "TLSv1.2",
      },
    });

    await transporter.sendMail({
      from: status.fromLabel!,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { provider: "smtp" as const };
  }

  // Resend API
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
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
