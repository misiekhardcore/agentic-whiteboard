import type { CapabilityContext, WorkspaceRecord } from "@v2/capabilities";
import type { Actor } from "@v2/contracts";
import { verifyRoomToken } from "@v2/contracts";
import { createInMemoryRoomOwner } from "@v2/contracts/testing";
import { describe, expect, it } from "vitest";

import type { DocService, FetchLike } from "./doc-service";
import { loadDocSession } from "./doc-session";

const actor: Actor = { type: "user", userId: "user-1", accountId: "account-1" };
const outsider: Actor = { type: "user", userId: "user-2", accountId: "account-2" };
const service: DocService = {
  wsUrl: "ws://127.0.0.1:3003",
  httpUrl: "http://127.0.0.1:3003",
  secret: "doc-secret",
};

const workspace: WorkspaceRecord = {
  id: "ws-1",
  name: "Product brief",
  accountId: "account-1",
  docRoomId: "doc-1",
  archived: false,
};

function context(record: WorkspaceRecord = workspace): CapabilityContext {
  return {
    actor,
    workspaces: { findById: (id) => Promise.resolve(id === record.id ? record : null) },
    rooms: createInMemoryRoomOwner(),
  };
}

const healthy: FetchLike = () => Promise.resolve(new Response("{}", { status: 200 }));
const unhealthy: FetchLike = () => Promise.resolve(new Response("", { status: 503 }));

describe("loadDocSession", () => {
  it("mints a write token naming the workspace's document room", async () => {
    const session = await loadDocSession({
      workspaceId: "ws-1",
      actor,
      context: context(),
      service,
      fetchImpl: healthy,
    });

    if (session.state !== "ready") throw new Error("expected a ready session");

    expect(session.connection).toMatchObject({
      url: "ws://127.0.0.1:3003",
      documentName: "doc-1",
      readOnly: false,
    });
    expect(
      verifyRoomToken({
        token: session.connection.token,
        audience: "doc",
        secret: service.secret,
      }),
    ).toMatchObject({
      userId: "user-1",
      roomId: "doc-1",
      accountId: "account-1",
      permission: "write",
      readOnly: false,
    });
  });

  it("mints a read-only token for an archived workspace", async () => {
    const session = await loadDocSession({
      workspaceId: "ws-1",
      actor,
      context: context({ ...workspace, archived: true }),
      service,
      fetchImpl: healthy,
    });

    if (session.state !== "ready") throw new Error("expected a ready session");

    expect(session.connection.readOnly).toBe(true);
    expect(
      verifyRoomToken({
        token: session.connection.token,
        audience: "doc",
        secret: service.secret,
      }),
    ).toMatchObject({ permission: "read", readOnly: true });
  });

  it("refuses a workspace in another account", async () => {
    const session = await loadDocSession({
      workspaceId: "ws-1",
      actor: outsider,
      context: { ...context(), actor: outsider },
      service,
      fetchImpl: healthy,
    });

    expect(session).toMatchObject({ state: "refused", code: "not-found" });
  });

  it("reports the service as unavailable when the health probe fails", async () => {
    const session = await loadDocSession({
      workspaceId: "ws-1",
      actor,
      context: context(),
      service,
      fetchImpl: unhealthy,
    });

    expect(session).toMatchObject({ state: "unavailable" });
  });

  it("reports an unconfigured deployment as unavailable", async () => {
    const session = await loadDocSession({
      workspaceId: "ws-1",
      actor,
      context: context(),
      service: null,
      fetchImpl: healthy,
    });

    expect(session).toMatchObject({ state: "unavailable" });
  });
});
