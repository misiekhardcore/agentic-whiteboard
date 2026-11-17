import { headers } from "next/headers";
import { z } from "zod";

import { defineCapability, success } from "@/lib/capabilities/define";
import { routes } from "@/lib/shared/routes";

import { changeMemberRole } from "../invitations";

import { outcome } from "./internals";

export const updateMemberRole = defineCapability({
  name: "updateMemberRole",
  description: "Move a member between member and admin.",
  input: z.object({
    organizationId: z.string(),
    memberId: z.string(),
    role: z.string().optional(),
  }),
  output: outcome,
  callers: ["human"] as const,
  invalidates: () => [routes.dashboardOrganization],
  handler: async (ctx, input) => {
    const refusal = await changeMemberRole({
      userId: ctx.actor.userId,
      organizationId: input.organizationId,
      memberId: input.memberId,
      role: input.role === "admin" ? "admin" : "member",
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});
