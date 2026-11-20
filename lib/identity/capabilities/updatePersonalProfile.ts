import { headers } from "next/headers";
import { z } from "zod";

import { capabilityFailureSchema, defineCapability, success } from "@/lib/capabilities/define";
import { CHANGE_KEYS } from "@/lib/shared/changes";

import { updatePersonalProfile as updatePersonalProfileFor } from "../authentication";

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
  changes: () => [{ key: CHANGE_KEYS.account, scope: "person" }],
  handler: async (_ctx, input) => {
    const refusal = await updatePersonalProfileFor({
      name: input.name,
      image: input.image ?? "",
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});
