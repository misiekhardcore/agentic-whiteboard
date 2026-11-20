import { deliver } from "./internals";
import type { EmailRecipient } from "./types";

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
    intro: "Use the button below to choose a new password for your WorkspAIce account.",
    action: "Choose a new password",
    url,
    note: "This link expires in one hour and can be used once. If you did not ask for a reset, you can ignore this email.",
  });
}
