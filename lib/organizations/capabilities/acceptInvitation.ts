import { headers } from "next/headers";
import { z } from "zod";

import { defineCapability, failure, success } from "@/lib/capabilities/define";
import { CHANGE_KEYS } from "@/lib/shared/changes";

import { acceptInvitation as acceptInvitationFor } from "../invitations";

import { outcome } from "./internals";

export const acceptInvitation = defineCapability({
  name: "acceptInvitation",
  description: "Accept an invitation addressed to the person's email address.",
  input: z.object({ invitationId: z.string() }),
  output: outcome,
  callers: ["human"] as const,
  changes: () => [{ key: CHANGE_KEYS.account, scope: "account" }],
  handler: async (_ctx, input) => {
    if (!input.invitationId) return failure("That invitation link is incomplete.");

    const refusal = await acceptInvitationFor({
      invitationId: input.invitationId,
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});
