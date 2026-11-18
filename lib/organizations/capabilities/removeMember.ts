import { headers } from "next/headers";
import { z } from "zod";

import { defineCapability, success } from "@/lib/capabilities/define";
import { CHANGE_KEYS } from "@/lib/shared/changes";

import { removeMember as removeMemberFor } from "../invitations";

import { outcome } from "./internals";

export const removeMember = defineCapability({
  name: "removeMember",
  description: "Remove someone from an organization the person administers.",
  input: z.object({ organizationId: z.string(), memberId: z.string() }),
  output: outcome,
  callers: ["human"] as const,
  changes: () => [{ key: CHANGE_KEYS.account, scope: "account" }],
  handler: async (ctx, input) => {
    const refusal = await removeMemberFor({
      userId: ctx.actor.userId,
      organizationId: input.organizationId,
      memberId: input.memberId,
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});
