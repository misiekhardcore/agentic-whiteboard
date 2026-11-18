import { z } from "zod";

import { capabilityFailureSchema } from "@/lib/capabilities/define";

export /**
 * The organization's operations.
 *
 * They are capabilities like any other — same validation, same refusal shape,
 * same declared changes — but `callers: ["human"]` says the agent may not perform
 * them. That is a policy decision, not a missing adapter: promoting one later is
 * this line, and the handler already enforces the role.
 *
 * Authorization lives in the application functions beside the Better Auth call,
 * because the rule needs the caller's role *in this organization* and there is
 * no row to hand from `authorize` to a handler.
 */
const outcome = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  capabilityFailureSchema,
]);
