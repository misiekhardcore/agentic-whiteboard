import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { transaction: mocks.transaction } }));

// The catalog reads the plan inside the create; the quota itself is covered by
// `usage.test.ts`, so the entitlement lookup is stubbed here.
vi.mock("@/lib/billing/entitlements", () => {
  const entitlements = {
    plan: { name: "Free" },
    limits: { agentPromptsPerMonth: 20, workspaces: 3 },
    subscription: null,
    capabilities: {},
  };

  return {
    getUserEntitlements: async () => entitlements,
    getOrganizationEntitlements: async () => entitlements,
  };
});

import {
  WORKSPACE_DESCRIPTION_MAX_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from "@/lib/workspace-form";

import {
  createWorkspaceFor,
  normalizeWorkspaceDraft,
  type WorkspaceActor,
} from "./workspace-service";

const actor: WorkspaceActor = {
  userId: "user_1",
  organizationId: null,
  accountName: "Personal account",
};

const ABORTED = "The request was stopped before the workspace was created.";

describe("normalizeWorkspaceDraft", () => {
  it("trims the name and stores an empty description as null", () => {
    expect(
      normalizeWorkspaceDraft({ name: "  Launch plan  ", description: "   " }),
    ).toEqual({
      draft: { name: "Launch plan", description: null },
      fieldErrors: {},
    });
  });

  it("keeps a description that has content", () => {
    expect(
      normalizeWorkspaceDraft({
        name: "Launch plan",
        description: "  Q4 rollout  ",
      }).draft,
    ).toEqual({ name: "Launch plan", description: "Q4 rollout" });
  });

  it("requires a name", () => {
    expect(
      normalizeWorkspaceDraft({ name: "   ", description: "" }),
    ).toEqual({
      draft: { name: "", description: null },
      fieldErrors: { name: "Name your workspace." },
    });
  });

  it("rejects an overlong name or description", () => {
    const longName = normalizeWorkspaceDraft({
      name: "a".repeat(WORKSPACE_NAME_MAX_LENGTH + 1),
      description: "",
    });
    expect(longName.fieldErrors.name).toBe(
      `Keep the name under ${WORKSPACE_NAME_MAX_LENGTH} characters.`,
    );

    const longDescription = normalizeWorkspaceDraft({
      name: "Launch plan",
      description: "a".repeat(WORKSPACE_DESCRIPTION_MAX_LENGTH + 1),
    });
    expect(longDescription.fieldErrors.description).toBe(
      `Keep the description under ${WORKSPACE_DESCRIPTION_MAX_LENGTH} characters.`,
    );
  });

  it("accepts a name and description at their limits", () => {
    expect(
      normalizeWorkspaceDraft({
        name: "a".repeat(WORKSPACE_NAME_MAX_LENGTH),
        description: "a".repeat(WORKSPACE_DESCRIPTION_MAX_LENGTH),
      }).fieldErrors,
    ).toEqual({});
  });
});

describe("createWorkspaceFor aborts", () => {
  it("does not start the transaction when the request already stopped", async () => {
    mocks.transaction.mockReset();
    const controller = new AbortController();
    controller.abort();

    const result = await createWorkspaceFor(
      actor,
      { name: "Launch plan" },
      { signal: controller.signal },
    );

    expect(result).toEqual({ ok: false, error: ABORTED });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not insert when the request stops before the write", async () => {
    const controller = new AbortController();
    const insert = vi.fn();

    mocks.transaction.mockReset();
    mocks.transaction.mockImplementation(
      async (run: (tx: unknown) => Promise<unknown>) =>
        run({
          // The quota count is the last await before the insert; stopping there
          // is exactly the window the guard exists for.
          execute: async () => {
            controller.abort();
          },
          select: () => ({ from: () => ({ where: async () => [{ total: 0 }] }) }),
          insert,
        }),
    );

    const result = await createWorkspaceFor(
      actor,
      { name: "Launch plan" },
      { signal: controller.signal },
    );

    expect(result).toEqual({ ok: false, error: ABORTED });
    expect(insert).not.toHaveBeenCalled();
  });

  it("still creates the workspace without a signal", async () => {
    const created = { id: "ws_1", name: "Launch plan", status: "PLANNING" };
    const returning = vi.fn(async () => [created]);
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));

    mocks.transaction.mockReset();
    mocks.transaction.mockImplementation(
      async (run: (tx: unknown) => Promise<unknown>) =>
        run({
          execute: async () => undefined,
          select: () => ({ from: () => ({ where: async () => [{ total: 0 }] }) }),
          insert,
        }),
    );

    const result = await createWorkspaceFor(actor, { name: "Launch plan" });

    expect(result).toEqual({ ok: true, workspace: created });
    expect(returning).toHaveBeenCalled();
  });
});
