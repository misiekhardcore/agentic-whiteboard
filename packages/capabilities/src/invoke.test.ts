import type { Actor } from "@v2/contracts";
import { createInMemoryRoomOwner } from "@v2/contracts/testing";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineCapability, invoke, success } from "./index";
import type { CapabilityContext } from "./index";

const person: Actor = { type: "user", userId: "user-1", accountId: "account-1" };

const context = (actor: Actor = person): CapabilityContext => {
  const workspaces = { findById: () => Promise.resolve(null) };
  return { actor, workspaces, rooms: createInMemoryRoomOwner() };
};

const readLength = defineCapability({
  name: "test.read-length",
  description: "Reads the length of a string it was authorized for.",
  effect: "read",
  callers: ["human"],
  input: z.object({ value: z.string() }),
  output: z.object({ length: z.number() }),
  authorize: (_ctx, input) => ({ value: input.value }),
  run: (_ctx, _input, resource) => success({ length: resource.value.length }),
});

describe("invoke", () => {
  it("runs the authorize step once and hands its row to the handler", async () => {
    const result = await invoke(readLength, context(), { value: "hello" });

    expect(result).toEqual({ ok: true, length: 5 });
  });

  it("returns invalid input as a value instead of throwing", async () => {
    const result = await invoke(readLength, context(), { value: 42 });

    expect(result).toMatchObject({ ok: false, code: "invalid-input" });
  });

  it("renders a null authorization as not found", async () => {
    let ran = false;
    const gated = defineCapability({
      name: "test.gated",
      description: "Only runs when its row is found.",
      effect: "read",
      callers: ["human"],
      input: z.object({}),
      output: z.object({ ok: z.boolean() }),
      authorize: () => null,
      run: () => {
        ran = true;
        return success({ ok: true });
      },
    });

    const result = await invoke(gated, context(), {});

    expect(result).toMatchObject({ ok: false, code: "not-found" });
    expect(ran).toBe(false);
  });

  it("refuses a caller the capability does not declare", async () => {
    let ran = false;
    const agentOnly = defineCapability({
      name: "test.agent-only",
      description: "Only the agent may call this.",
      effect: "read",
      callers: ["agent"],
      input: z.object({}),
      output: z.object({ ok: z.boolean() }),
      run: () => {
        ran = true;
        return success({ ok: true });
      },
    });

    const result = await invoke(agentOnly, context(), {});

    expect(result).toMatchObject({ ok: false, code: "not-a-caller" });
    expect(ran).toBe(false);
  });
});
