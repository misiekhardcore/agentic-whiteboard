import { z } from "zod";

import {
  capabilityFailureSchema,
  defineCapability,
  failure,
  success,
} from "@/lib/capabilities/define";
import { routes } from "@/lib/shared/routes";

import { saveReadAloud } from "../settings";

/**
 * The person's read aloud choice. It is human-only for the same reason as the
 * profile: speaking is a decision about the person's own device, not something
 * the agent acting for them may turn on.
 */
export const setReadAloud = defineCapability({
  name: "setReadAloud",
  description: "Turn reading agent replies aloud on or off.",
  input: z.object({ enabled: z.boolean() }),
  output: z.discriminatedUnion("ok", [z.object({ ok: z.literal(true) }), capabilityFailureSchema]),
  callers: ["human"] as const,
  invalidates: () => [routes.dashboard],
  handler: async (ctx, input) => {
    try {
      await saveReadAloud(ctx.actor.userId, input.enabled);
    } catch {
      return failure("Could not save the read aloud setting. Try again.");
    }

    return success({});
  },
});
