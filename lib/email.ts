import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const DEFAULT_FROM = "Agentic Whiteboard <no-reply@localhost>";

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  const host = process.env.SMTP_HOST;
  if (!host) {
    throw new Error(
      "SMTP_HOST is not set. Start the local mail catcher (pnpm db:mail) and copy the SMTP_* values from .env.example.",
    );
  }

  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 2500);
    const user = process.env.SMTP_USER;
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass: process.env.SMTP_PASS } : undefined,
    });
  }

  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type EmailContent = {
  to: string;
  subject: string;
  heading: string;
  intro: string;
  action: string;
  url: string;
  note: string;
};

function render({
  heading,
  intro,
  action,
  url,
  note,
}: Omit<EmailContent, "to" | "subject">) {
  const safeUrl = escapeHtml(url);

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#18181b">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:32px">
      <h1 style="margin:0 0 12px;font-size:18px;line-height:1.4">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46">${escapeHtml(intro)}</p>
      <a href="${safeUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">${escapeHtml(action)}</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#71717a">${escapeHtml(note)}</p>
      <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;word-break:break-all">${safeUrl}</p>
    </div>
  </body>
</html>`;

  const text = `${heading}

${intro}

${action}: ${url}

${note}
`;

  return { html, text };
}

export type EmailRecipient = {
  email: string;
  name?: string | null;
};

/**
 * A mail server being down must not turn sign-up or a reset request into a
 * 500: the sign-up still succeeds (verification is not required) and the
 * person can ask for a fresh link once mail is reachable. Failures are logged
 * with the recipient so the cause is visible in the dev server output.
 */
async function deliver({ to, subject, ...content }: EmailContent): Promise<void> {
  const { html, text } = render(content);

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || DEFAULT_FROM,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error(`[email] failed to send "${subject}" to ${to}:`, error);
  }
}

export async function sendVerificationEmail({
  user,
  url,
}: {
  user: EmailRecipient;
  url: string;
}): Promise<void> {
  const name = user.name?.trim() || user.email;

  await deliver({
    to: user.email,
    subject: "Confirm your email address",
    heading: `Welcome, ${name}`,
    intro:
      "Confirm your email address to finish setting up your Agentic Whiteboard account.",
    action: "Confirm email",
    url,
    note: "This link expires in one hour. If you did not create an account, you can ignore this email.",
  });
}

export async function sendOrganizationInvitationEmail({
  to,
  organizationName,
  inviterName,
  role,
  url,
}: {
  to: string;
  organizationName: string;
  inviterName: string;
  role: string;
  url: string;
}): Promise<void> {
  await deliver({
    to,
    subject: `Join ${organizationName} on Agentic Whiteboard`,
    heading: `You’re invited to ${organizationName}`,
    intro: `${inviterName} invited you to join ${organizationName} as ${role}. Accept to share the same workspaces, canvas and agent context.`,
    action: "Accept invitation",
    url,
    note: "This invitation expires in 48 hours. If you were not expecting it, you can ignore this email.",
  });
}

export async function sendPasswordResetEmail({
  user,
  url,
}: {
  user: EmailRecipient;
  url: string;
}): Promise<void> {
  const name = user.name?.trim() || user.email;

  await deliver({
    to: user.email,
    subject: "Reset your password",
    heading: `Reset your password, ${name}`,
    intro:
      "Use the button below to choose a new password for your Agentic Whiteboard account.",
    action: "Choose a new password",
    url,
    note: "This link expires in one hour and can be used once. If you did not ask for a reset, you can ignore this email.",
  });
}
