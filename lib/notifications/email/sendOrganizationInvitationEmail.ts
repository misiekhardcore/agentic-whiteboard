import { deliver } from "./internals";

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
    subject: `Join ${organizationName} on WorkspAIce`,
    heading: `You’re invited to ${organizationName}`,
    intro: `${inviterName} invited you to join ${organizationName} as ${role}. Accept to share the same workspaces, canvas and agent context.`,
    action: "Accept invitation",
    url,
    note: "This invitation expires in 48 hours. If you were not expecting it, you can ignore this email.",
  });
}
