import { headers } from "next/headers";
import { z } from "zod";

import { defineCapability, success } from "@/lib/capabilities/define";

import { switchAccount as switchAccountFor } from "../invitations";

import { MENU, outcome } from "./internals";

export const switchAccount = defineCapability({
  name: "switchAccount",
  description: "Make one of the person's organizations their active account, or the personal one.",
  input: z.object({ organizationId: z.string().optional() }),
  output: outcome,
  callers: ["human"] as const,
  invalidates: () => [MENU],
  handler: async (ctx, input) => {
    const raw = input.organizationId?.trim();
    const refusal = await switchAccountFor({
      userId: ctx.actor.userId,
      organizationId: raw && raw !== "personal" ? raw : null,
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});
