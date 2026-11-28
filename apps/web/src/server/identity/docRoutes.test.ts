import { beforeEach, describe, expect, it, vi } from "vitest";

type RouteState = {
  session: SessionActor | null;
  workspaceAccountId: string;
  saved: unknown[];
};

const state = vi.hoisted((): RouteState => ({
  session: null,
  workspaceAccountId: "acct-a",
  saved: [],
}));

vi.mock("@/src/server/identity/actor", () => ({
  requireActor: () => Promise.resolve(state.session),
}));

vi.mock("@/src/server/dependencies", () => ({
  getDependencies: () => ({
    workspaces: {
      findById: (id: string) =>
        Promise.resolve(
          id === "ws-a"
            ? {
                id: "ws-a",
                name: "Brief",
                accountId: state.workspaceAccountId,
                docRoomId: "doc-a",
                archived: false,
              }
            : null,
        ),
    },
    rooms: {
      save: (input: unknown) => {
        state.saved.push(input);
        return Promise.resolve({ revision: "rev-1" });
      },
      snapshot: () => Promise.reject(new Error("not used")),
      apply: () => Promise.reject(new Error("not used")),
      revoke: () => Promise.reject(new Error("not used")),
    },
  }),
}));

import { POST as saveRoute } from "../../../app/api/doc/[workspaceId]/save/route";

import type { SessionActor } from "./types";

function actorIn(accountId: string): SessionActor {
  return {
    actor: { type: "user", userId: "user-1", accountId },
    person: { name: "Ada", email: "ada@example.com" },
    account: { id: accountId, organizationId: accountId === "user-1" ? null : accountId },
  };
}

function callSave(workspaceId = "ws-a") {
  return saveRoute(
    new Request(`http://localhost/api/doc/${workspaceId}/save`, { method: "POST" }),
    {
      params: Promise.resolve({ workspaceId }),
    },
  );
}

beforeEach(() => {
  state.session = null;
  state.workspaceAccountId = "acct-a";
  state.saved = [];
});

describe("document mutation routes", () => {
  it("refuses a save before touching the room when there is no session", async () => {
    const response = await callSave();

    expect(response.status).toBe(401);
    expect(state.saved).toEqual([]);
  });

  it("refuses a save rendered under account A when the session now says B", async () => {
    state.session = actorIn("acct-b");

    const response = await callSave();

    expect(response.status).toBe(404);
    expect(state.saved).toEqual([]);
  });

  it("saves for the session that owns the workspace", async () => {
    state.session = actorIn("acct-a");

    const response = await callSave();

    expect(response.status).toBe(200);
    expect(state.saved).toHaveLength(1);
  });
});
