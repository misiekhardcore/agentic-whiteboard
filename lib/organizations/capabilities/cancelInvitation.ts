import { headers } from "next/headers";
import { z } from "zod";

import { defineCapability, success } from "@/lib/capabilities/define";
import { routes } from "@/lib/shared/routes";

import { cancelInvitation as cancelInvitationFor } from "../invitations";

import { outcome } from "./internals";

export const cancelInvitation = defineCapability({
  name: "cancelInvitation",
  description: "Cancel a pending invitation so its link stops working.",
  input: z.object({ invitationId: z.string() }),
  output: outcome,
  callers: ["human"] as const,
  invalidates: () => [routes.dashboardOrganization],
  handler: async (ctx, input) => {
    const refusal = await cancelInvitationFor({
      userId: ctx.actor.userId,
      invitationId: input.invitationId,
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});
