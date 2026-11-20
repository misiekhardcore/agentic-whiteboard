import type { z } from "zod";

import type { AccountActor } from "@/lib/identity/actor";
import type { Change } from "@/lib/shared/changes";

export type { Change };

import type { ToolPresentation } from "../presentation";

/**
 * One capability: the single definition an agent tool, a server action and the
 * conversation's tool line all derive from.
 *
 * Validation, authorization, the result contract and the changed datasets are
 * declared here rather than at each call site, so a caller cannot skip one. A
 * capability module is never marked `"use server"`: handlers are plain server
 * functions, and only the wrappers in a `"use server"` file become endpoints.
 *
 * The kernel keeps no domain knowledge. This module declares the contract;
 * `invoke.ts` runs it and `describe.ts` widens it for the registry.
 */
export type CapabilityCaller = "human" | "agent";

/**
 * Why an operation did not happen. Deliberately a value and not an exception:
 * the model has to be able to read it and try something else, and a person has
 * to see the sentence in the form.
 *
 * Domain services return this shape too, so a refusal crosses the capability
 * boundary without a translation layer.
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

export type CapabilityContext = {
  actorType: CapabilityCaller;
  actor: AccountActor;
  /** Set when the agent acts; the prompt this call belongs to. */
  promptId?: string;
  /** The run's stop signal, forwarded to every write. */
  abortSignal?: AbortSignal;
  /**
   * Told what a successful call changed, for a caller that answers in a stream:
   * a tool's changes reach that browser through the reply it is already reading.
   */
  onChanges?: (changes: Change[]) => void;
};

export type CapabilityOptions = { signal?: AbortSignal };

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
  /**
   * The datasets a successful call changes, published to the interface. A
   * capability declares what a person will see change, not which route it
   * happened to render.
   */
  changes?: (output: CapabilitySuccess<T>) => Change[];
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

/**
 * A capability widened for the places that only need the surface: the tool
 * catalog, the conversation's tool line and the registry invariants. Keeping
 * the widening in `describe.ts` means no call site has to cast a handler's
 * input.
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
