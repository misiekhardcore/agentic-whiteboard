import { headers } from "next/headers";
import { z } from "zod";

import {
  capabilityFailureSchema,
  defineCapability,
  failure,
  success,
} from "@/lib/capabilities/define";
import { routes } from "@/lib/shared/routes";

import { updatePersonalProfile as updatePersonalProfileFor } from "./authentication";
import { MAX_READ_ALOUD_VOICE_NAME, saveReadAloud, saveReadAloudVoice } from "./settings";

/**
 * The person's own profile, as a capability. `callers: ["human"]` is the policy:
 * an agent editing the account it acts for is a different decision, and it is
 * not this one.
 */
export const updatePersonalProfile = defineCapability({
  name: "updatePersonalProfile",
  description: "Change the person's display name or profile photo.",
  input: z.object({ name: z.string(), image: z.string().optional() }),
  output: z.discriminatedUnion("ok", [z.object({ ok: z.literal(true) }), capabilityFailureSchema]),
  callers: ["human"] as const,
  invalidates: () => [{ path: "/", layout: true }],
  handler: async (_ctx, input) => {
    const refusal = await updatePersonalProfileFor({
      name: input.name,
      image: input.image ?? "",
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});

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

/**
 * The voice a reply is read in, stored by name. Human-only like the toggle it
 * sits beside: which voice speaks through the person's speakers is their choice,
 * not the agent's. An empty name means the browser's own default.
 */
export const setReadAloudVoice = defineCapability({
  name: "setReadAloudVoice",
  description: "Choose which browser voice reads agent replies aloud.",
  input: z.object({ voice: z.string().trim().max(MAX_READ_ALOUD_VOICE_NAME) }),
  output: z.discriminatedUnion("ok", [z.object({ ok: z.literal(true) }), capabilityFailureSchema]),
  callers: ["human"] as const,
  invalidates: () => [routes.dashboard],
  handler: async (ctx, input) => {
    try {
      await saveReadAloudVoice(ctx.actor.userId, input.voice);
    } catch {
      return failure("Could not save the read aloud voice. Try again.");
    }

    return success({});
  },
});
