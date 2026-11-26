import { callerOf } from "@v2/contracts";
import type { Result } from "@v2/contracts";

import type { CapabilityContext } from "./context";
import type { AppCapability } from "./define";
import { inputFieldErrors } from "./internals";
import { refusal } from "./result";

/**
 * The one way a capability is called. Every caller goes through it, so the
 * caller check, validation, authorization and result contract cannot be
 * skipped by a new entry point.
 *
 * Only a broken handler throws (its output does not match the declared schema);
 * everything a caller can cause is returned as a value.
 */
export async function invoke<Input, Output extends object, Resource>(
  capability: AppCapability<Input, Output, Resource>,
  context: CapabilityContext,
  raw: unknown,
): Promise<Result<Output>> {
  if (!capability.callers.includes(callerOf(context.actor))) {
    return refusal("not-a-caller", "That operation is not available here.");
  }

  const parsed = capability.input.safeParse(raw);
  if (!parsed.success) {
    return refusal("invalid-input", "Check the details and try again.", {
      fieldErrors: inputFieldErrors(parsed.error),
      hint: "Fix the fields it names and call it again with every required field.",
    });
  }

  const resource =
    capability.authorize === undefined
      ? (undefined as Resource)
      : await capability.authorize(context, parsed.data);

  if (resource === null) {
    return refusal("not-found", "That item could not be found.");
  }

  const output = await capability.run(context, parsed.data, resource);
  if (!output.ok) return output;

  // The payload is parsed, not cast: a handler returning the wrong shape is a
  // bug and must fail loudly instead of handing a caller a malformed result.
  return { ok: true, ...capability.output.parse(output) };
}
