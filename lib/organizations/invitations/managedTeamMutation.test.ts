import { beforeEach, describe, expect, it, vi } from "vitest";

import { managedTeamMutation } from "./managedTeamMutation";

const mocks = vi.hoisted(() => {
  const state: {
    role: string | null;
    translated: string;
    translateCalls: { fallback: string }[];
  } = {
    role: "admin",
    translated: "That person is already a member.",
    translateCalls: [],
  };

  return state;
});

vi.mock("../queries", () => ({
  getMemberRole: vi.fn(() => Promise.resolve(mocks.role)),
}));

vi.mock("../errors", () => ({
  organizationErrorMessage: vi.fn((_error: unknown, fallback: string) => {
    mocks.translateCalls.push({ fallback });
    return mocks.translated;
  }),
}));

const context = { userId: "user_1", organizationId: "org_1" };

const mutation = {
  refusal: "Only owners and admins can invite people.",
  fallback: "Could not send the invitation.",
  log: "[organizations] could not invite a member:",
  run: vi.fn(() => Promise.resolve()),
};

describe("a managed team mutation", () => {
  beforeEach(() => {
    mocks.role = "admin";
    mocks.translated = "That person is already a member.";
    mocks.translateCalls.length = 0;
    mutation.run.mockReset();
    mutation.run.mockResolvedValue(undefined);
  });

  it("refuses a plain member without running the operation", async () => {
    mocks.role = "member";

    const refused = await managedTeamMutation(context, mutation);

    expect(refused).toEqual({ ok: false, error: mutation.refusal });
    expect(mutation.run).not.toHaveBeenCalled();
  });

  it("refuses somebody with no membership at all", async () => {
    mocks.role = null;

    const refused = await managedTeamMutation(context, mutation);

    expect(refused?.ok).toBe(false);
    expect(mutation.run).not.toHaveBeenCalled();
  });

  it("runs the operation for an owner and reports nothing", async () => {
    mocks.role = "owner";

    await expect(managedTeamMutation(context, mutation)).resolves.toBeNull();
    expect(mutation.run).toHaveBeenCalledOnce();
  });

  it("turns the adapter's refusal into the operation's sentence", async () => {
    mutation.run.mockRejectedValueOnce(new Error("Better Auth said no"));

    const refused = await managedTeamMutation(context, mutation);

    expect(refused).toEqual({ ok: false, error: mocks.translated });
    expect(mocks.translateCalls).toEqual([{ fallback: mutation.fallback }]);
  });

  it("stops before the write when the row fails its own rules", async () => {
    const prepare = vi.fn(() => Promise.resolve({ ok: false as const, error: "Not that one." }));

    const refused = await managedTeamMutation(context, { ...mutation, prepare });

    expect(refused).toEqual({ ok: false, error: "Not that one." });
    expect(mutation.run).not.toHaveBeenCalled();
  });

  it("does not look the row up for a caller who may not manage the team", async () => {
    mocks.role = "member";
    const prepare = vi.fn(() => Promise.resolve(null));

    await managedTeamMutation(context, { ...mutation, prepare });

    expect(prepare).not.toHaveBeenCalled();
  });

  it("leaves a failed write traceable without throwing", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mutation.run.mockRejectedValueOnce(new Error("database is down"));

    await managedTeamMutation(context, mutation);

    expect(logged).toHaveBeenCalledWith(mutation.log, expect.any(Error));
    logged.mockRestore();
  });
});
