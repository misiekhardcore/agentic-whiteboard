import type { Caller } from "./actor";
import type { Change } from "./changes";

/**
 * Whether a capability reads or writes. The effect decides the approval path:
 * reads run during reasoning, writes are collected, gated and committed.
 */
export type Effect = "read" | "write";

/**
 * The schema shapes a capability needs. They are structural rather than a
 * concrete library type so contracts stays dependency-free while Zod (or any
 * other schema) still satisfies them.
 */
export type InputSchema<Input> = {
  safeParse(value: unknown): SafeParseResult<Input>;
};

export type SafeParseResult<Input> =
  { success: true; data: Input } | { success: false; error: unknown };

export type OutputSchema<Output> = {
  parse(value: unknown): Output;
};

/**
 * Why an operation did not happen. A refusal is a value, not an exception: the
 * model has to be able to read it and a person has to see it in the interface.
 */
export type RefusalCode =
  "not-found" | "invalid-input" | "not-a-caller" | "read-only" | "unavailable";

export type Refusal = {
  ok: false;
  code: RefusalCode;
  error: string;
  hint?: string;
  fieldErrors?: Record<string, string>;
};

export type Success<Output> = { ok: true } & Output;

export type Result<Output> = Success<Output> | Refusal;

/**
 * One semantic operation. Its input, authorization and result are declared
 * here, so a person's click and an agent's tool call cannot validate, authorize
 * or answer differently.
 */
export type Capability<Context, Input, Output, Resource> = {
  /** The stored key and, later, the tool name. Renaming one breaks history. */
  name: string;
  /** Model-facing copy: when to call it and what it returns. */
  description: string;
  effect: Effect;
  /** Who may call it. Exposure is decided here, not by the caller. */
  callers: readonly Caller[];
  input: InputSchema<Input>;
  /** The success payload. The kernel owns the `ok` envelope, not the schema. */
  output: OutputSchema<Output>;
  /**
   * Loads and authorizes the row the handler then uses. `null` reports the
   * resource as missing rather than forbidden, so an answer never confirms that
   * another tenant's id exists.
   */
  authorize?: (context: Context, input: Input) => Promise<Resource | null> | Resource | null;
  run: (
    context: Context,
    input: Input,
    resource: Resource,
  ) => Promise<Result<Output>> | Result<Output>;
  /** The datasets a successful write changed. A read declares none. */
  changes?: (output: Output) => readonly Change[];
};
