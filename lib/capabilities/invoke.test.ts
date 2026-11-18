import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const publisher = vi.hoisted(() => ({ publishChanges: vi.fn(() => Promise.resolve()) }));

vi.mock("./changes", () => publisher);

import {
  type Capability,
  type CapabilityContext,
  defineCapability,
  failure,
  success,
} from "./define";
import { invoke } from "./invoke";

const actor = {
  userId: "user_1",
  organizationId: null,
  accountName: "Personal account",
};

const humanContext: CapabilityContext = { actorType: "human", actor };
const agentContext: CapabilityContext = {
  actorType: "agent",
  actor,
  promptId: "prompt_1",
};

const outputSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), value: z.string() }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
    hint: z.string().optional(),
    fieldErrors: z.record(z.string(), z.string()).optional(),
    limitReached: z.boolean().optional(),
  }),
]);

function renameCapability(
  overrides: Partial<
    Capability<{ id: string; value: string }, { value: string }, { id: string }>
  > = {},
) {
  const handler = vi.fn((_ctx: CapabilityContext, input: { id: string; value: string }) =>
    success({ value: input.value }),
  );

  const capability = defineCapability({
    name: "rename",
    description: "Rename a thing.",
    input: z.object({
      id: z.string({ error: "Choose the thing to rename." }).min(1, "Choose the thing to rename."),
      value: z.string({ error: "Write the new name." }).min(1, "Write the new name."),
    }),
    output: outputSchema,
    callers: ["human", "agent"] as const,
    authorize: () => ({ id: "thing_1" }),
    handler,
    ...overrides,
  });

  return { capability, handler };
}

describe("invoke", () => {
  it("reports the fields a draft is missing instead of running anything", async () => {
    const { capability, handler } = renameCapability();

    const output = await invoke(capability, humanContext, { id: "thing_1" });

    expect(output).toMatchObject({
      ok: false,
      fieldErrors: { value: "Write the new name." },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("reports an unauthorized resource as missing, not as forbidden", async () => {
    const { capability, handler } = renameCapability({ authorize: () => null });

    const output = await invoke(capability, humanContext, {
      id: "thing_other",
      value: "Launch",
    });

    expect(output).toEqual({
      ok: false,
      error: "That item could not be found.",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("hands the handler the authorized resource and the run's stop signal", async () => {
    const controller = new AbortController();
    const { capability, handler } = renameCapability();

    await invoke(
      capability,
      { ...agentContext, abortSignal: controller.signal },
      { id: "thing_1", value: "Launch" },
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: "agent", promptId: "prompt_1" }),
      { id: "thing_1", value: "Launch" },
      { id: "thing_1" },
      { signal: controller.signal },
    );
  });

  it("returns a refusal as a value the caller can read", async () => {
    const { capability } = renameCapability({
      handler: () => failure("That name is taken.", { hint: "Try another name." }),
    });

    const output = await invoke(capability, humanContext, {
      id: "thing_1",
      value: "Launch",
    });

    expect(output).toEqual({
      ok: false,
      error: "That name is taken.",
      hint: "Try another name.",
    });
  });

  it("refuses a caller the capability does not list", async () => {
    const { capability, handler } = renameCapability({ callers: ["human"] });

    const output = await invoke(capability, agentContext, {
      id: "thing_1",
      value: "Launch",
    });

    expect(output).toEqual({
      ok: false,
      error: "That operation is not available here.",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("publishes the datasets a successful call declares, once, for either caller", async () => {
    const { capability } = renameCapability({
      changes: () => [{ key: "workspaces", scope: "account" }],
    });

    await invoke(capability, humanContext, { id: "thing_1", value: "Launch" });
    await invoke(capability, agentContext, { id: "thing_1", value: "Launch" });

    expect(publisher.publishChanges).toHaveBeenCalledTimes(2);
    expect(publisher.publishChanges).toHaveBeenCalledWith({
      changes: [{ key: "workspaces", scope: "account" }],
      actor,
    });
  });

  it("tells the caller's own stream what changed, so a tool's write reaches its tab", async () => {
    const { capability } = renameCapability({
      changes: () => [{ key: "workspaces", scope: "account" }],
    });
    const onChanges = vi.fn();

    await invoke(capability, { ...agentContext, onChanges }, { id: "thing_1", value: "Launch" });
    expect(onChanges).toHaveBeenCalledWith([{ key: "workspaces", scope: "account" }]);

    onChanges.mockClear();
    await invoke(
      renameCapability({
        changes: () => [{ key: "workspaces", scope: "account" }],
        handler: () => ({ ok: false, error: "That name is taken." }),
      }).capability,
      { ...agentContext, onChanges },
      { id: "thing_1", value: "Launch" },
    );
    expect(onChanges).not.toHaveBeenCalled();
  });

  it("publishes nothing when the call changed nothing", async () => {
    const { capability } = renameCapability({
      changes: () => [{ key: "workspaces", scope: "account" }],
      handler: () => ({ ok: false, error: "That name is taken." }),
    });

    await invoke(capability, humanContext, { id: "thing_1", value: "Launch" });

    expect(publisher.publishChanges).not.toHaveBeenCalled();
  });

  it("throws when a handler returns a shape its own schema rejects", async () => {
    const { capability } = renameCapability({
      handler: () =>
        ({ ok: true, value: 42 }) as unknown as ReturnType<typeof success<{ value: string }>>,
    });

    await expect(
      invoke(capability, humanContext, { id: "thing_1", value: "Launch" }),
    ).rejects.toThrow();
  });
});
