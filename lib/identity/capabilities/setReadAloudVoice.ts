import { z } from "zod";

import {
  capabilityFailureSchema,
  defineCapability,
  failure,
  success,
} from "@/lib/capabilities/define";
import { CHANGE_KEYS } from "@/lib/shared/changes";

import { MAX_READ_ALOUD_VOICE_NAME, saveReadAloudVoice } from "../settings";

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
  changes: () => [{ key: CHANGE_KEYS.settings, scope: "person" }],
  handler: async (ctx, input) => {
    try {
      await saveReadAloudVoice(ctx.actor.userId, input.voice);
    } catch {
      return failure("Could not save the read aloud voice. Try again.");
    }

    return success({});
  },
});
