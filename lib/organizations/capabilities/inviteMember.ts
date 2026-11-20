import { headers } from "next/headers";
import { z } from "zod";

import { defineCapability, success } from "@/lib/capabilities/define";
import { CHANGE_KEYS } from "@/lib/shared/changes";

import { inviteMember as inviteMemberFor } from "../invitations";

import { outcome } from "./internals";

export const inviteMember = defineCapability({
  name: "inviteMember",
  description: "Invite someone to an organization the person administers.",
  input: z.object({
    organizationId: z.string(),
    email: z.string(),
    role: z.string().optional(),
  }),
  output: outcome,
  callers: ["human"] as const,
  changes: () => [{ key: CHANGE_KEYS.account, scope: "account" }],
  handler: async (ctx, input) => {
    const refusal = await inviteMemberFor({
      userId: ctx.actor.userId,
      organizationId: input.organizationId,
      email: input.email,
      role: input.role === "admin" ? "admin" : "member",
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});
