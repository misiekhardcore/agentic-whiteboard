import { deliver } from "./internals";
import type { EmailRecipient } from "./types";

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
    intro: "Confirm your email address to finish setting up your Agentic Whiteboard account.",
    action: "Confirm email",
    url,
    note: "This link expires in one hour. If you did not create an account, you can ignore this email.",
  });
}
