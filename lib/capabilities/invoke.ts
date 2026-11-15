import type { ZodError } from "zod";

import { type Capability, type CapabilityContext, type CapabilityOutput, failure } from "./define";

/**
 * The one way a capability is called. Every caller goes through this, so the
 * validation, the authorization and the result contract cannot be skipped.
 *
 * Only a broken handler throws (its output does not match the declared schema);
 * everything a caller can cause is returned as a value.
 */

/** The field messages from a rejected input, first issue per field wins. */
function inputFieldErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

export async function invoke<I, T, R>(
  capability: Capability<I, T, R>,
  ctx: CapabilityContext,
  raw: unknown,
): Promise<CapabilityOutput<T>> {
  if (!capability.callers.includes(ctx.actorType)) {
    return failure("That operation is not available here.");
  }

  const parsed = capability.input.safeParse(raw);
  if (!parsed.success) {
    return failure("Check the details and try again.", {
      fieldErrors: inputFieldErrors(parsed.error),
      hint: "Fix the fields it names and call it again with every required field.",
    });
  }

  const resource =
    capability.authorize === undefined
      ? (undefined as R)
      : await capability.authorize(ctx, parsed.data);

  if (resource === null) {
    return failure(capability.notFound ?? "That item could not be found.");
  }

  const output = await capability.handler(ctx, parsed.data, resource, {
    signal: ctx.abortSignal,
  });

  // A handler that returns the wrong shape is a bug in the handler, not a
  // refusal: fail loudly instead of handing a caller a malformed result.
  capability.output.parse(output);

  return output;
}
