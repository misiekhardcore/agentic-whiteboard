import { z } from "zod";

import type { AccountActor } from "@/lib/actor";

import type { ToolPresentation } from "./presentation";

/**
 * One capability: the single definition an agent tool, a server action and the
 * conversation's tool line all derive from.
 *
 * Validation, authorization, the result contract and the invalidation paths are
 * declared here rather than at each call site, so a caller cannot skip one. A
 * capability module is never marked `"use server"`: handlers are plain server
 * functions, and only the wrappers in a `"use server"` file become endpoints.
 */

export type CapabilityCaller = "human" | "agent";

/**
 * Why an operation did not happen. Deliberately a value and not an exception:
 * the model has to be able to read it and try something else, and a person has
 * to see the sentence in the form.
 */
export type CapabilityFailure = {
  ok: false;
  error: string;
  /** The next thing to try, phrased for whoever is reading it. */
  hint?: string;
  /** Per-field messages, keyed by input field, for the forms. */
  fieldErrors?: Record<string, string>;
  /** True when a plan limit is what refused the call. */
  limitReached?: boolean;
};

export type CapabilitySuccess<T> = { ok: true } & T;
export type CapabilityOutput<T> = CapabilitySuccess<T> | CapabilityFailure;

/** The success half is per capability; the failure half is always this shape. */
export const capabilityFailureSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  hint: z.string().optional(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
  limitReached: z.boolean().optional(),
});

export function failure(
  error: string,
  extra: Omit<CapabilityFailure, "ok" | "error"> = {},
): CapabilityFailure {
  return { ok: false, error, ...extra };
}

export function success<T>(payload: T): CapabilitySuccess<T> {
  return { ok: true, ...payload };
}

export type CapabilityContext = {
  actorType: CapabilityCaller;
  actor: AccountActor;
  /** Set when the agent acts; the prompt this call belongs to. */
  promptId?: string;
  /** The run's stop signal, forwarded to every write. */
  abortSignal?: AbortSignal;
};

export type CapabilityOptions = { signal?: AbortSignal };

export type { ToolPresentation };

/** Client-only tools are performed by the browser; there is no server execute. */
export type ClientToolHandler = "openWorkspace";

export type Capability<I, T, R = undefined> = {
  /** The tool name and the stored key. Renaming one breaks history. */
  name: string;
  /** Model-facing copy: when to call it and what it returns. */
  description: string;
  input: z.ZodType<I>;
  output: z.ZodType<CapabilityOutput<T>>;
  callers: readonly CapabilityCaller[];
  /** When set, an agent call pauses for the person's decision. */
  approval?: "always";
  /** When set, the browser performs this call and the server only offers it. */
  client?: ClientToolHandler;
  /** Route paths to revalidate after a successful human call. */
  invalidates?: (output: CapabilitySuccess<T>) => string[];
  /** What a missing resource reports; defaults to a generic sentence. */
  notFound?: string;
  /**
   * Loads and authorizes the resource the handler then uses. Returning `null`
   * reports it as missing rather than forbidden, so an answer never confirms
   * that another tenant's id exists. Omit it when the capability is account
   * scoped and has no row to load.
   */
  authorize?: (ctx: CapabilityContext, input: I) => Promise<R | null> | R | null;
  handler: (
    ctx: CapabilityContext,
    input: I,
    resource: R,
    options: CapabilityOptions,
  ) => CapabilityOutput<T> | Promise<CapabilityOutput<T>>;
  /** How the call reads in the conversation. */
  present?: (input: I) => ToolPresentation;
};

export function defineCapability<I, T, R = undefined>(
  capability: Capability<I, T, R>,
): Capability<I, T, R> {
  return capability;
}

/**
 * A capability the browser performs: the agent may call it, but the server only
 * offers the tool. There is deliberately no handler, so nothing can run it on
 * the server and pretend the interface did something.
 */
export type ClientCapability<I> = {
  name: string;
  description: string;
  input: z.ZodType<I>;
  callers: readonly CapabilityCaller[];
  client: ClientToolHandler;
  present?: (input: I) => ToolPresentation;
};

export function defineClientCapability<I>(capability: ClientCapability<I>): ClientCapability<I> {
  return capability;
}

/**
 * A capability widened for the places that only need the surface: the tool
 * catalog, the conversation's tool line and the registry invariants. Keeping
 * the widening here means no call site has to cast a handler's input.
 */
export type CapabilityDescriptor = {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
  callers: readonly CapabilityCaller[];
  approval: boolean;
  client?: ClientToolHandler;
  present?: (input: unknown) => ToolPresentation;
  invoke?: (ctx: CapabilityContext, raw: unknown) => Promise<CapabilityOutput<unknown>>;
};

function presentation<I>(
  present: ((input: I) => ToolPresentation) | undefined,
): ((input: unknown) => ToolPresentation) | undefined {
  return present ? (input: unknown) => present(input as I) : undefined;
}

export function describeCapability<I, T, R>(capability: Capability<I, T, R>): CapabilityDescriptor {
  return {
    name: capability.name,
    description: capability.description,
    inputSchema: capability.input,
    callers: capability.callers,
    approval: capability.approval === "always",
    present: presentation(capability.present),
    invoke: (ctx, raw) => invoke(capability, ctx, raw),
  };
}

export function describeClientCapability<I>(capability: ClientCapability<I>): CapabilityDescriptor {
  return {
    name: capability.name,
    description: capability.description,
    inputSchema: capability.input,
    callers: capability.callers,
    approval: false,
    client: capability.client,
    present: presentation(capability.present),
  };
}

/** The field messages from a rejected input, first issue per field wins. */
function inputFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

/**
 * The one way a capability is called. Every caller goes through this, so the
 * validation, the authorization and the result contract cannot be skipped.
 *
 * Only a broken handler throws (its output does not match the declared schema);
 * everything a caller can cause is returned as a value.
 */
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
