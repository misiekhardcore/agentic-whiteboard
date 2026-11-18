import { publishChanges } from "../changes";
import { type Capability, type CapabilityContext, type CapabilityOutput, failure } from "../define";

import { inputFieldErrors } from "./internals";

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

  // Published here rather than in the entry points, so a person's action, an
  // agent's tool call and a future caller all tell the interface the same way.
  // A refusal changes nothing and broadcasts nothing.
  if (output.ok && capability.changes) {
    const changes = capability.changes(output);
    await publishChanges({ changes, actor: ctx.actor });
    ctx.onChanges?.(changes);
  }

  return output;
}
