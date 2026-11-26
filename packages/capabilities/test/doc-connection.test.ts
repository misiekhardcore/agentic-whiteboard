import type { Actor } from "@v2/contracts";
import { createInMemoryRoomOwner } from "@v2/contracts/testing";
import { describe, expect, it } from "vitest";

import { docConnection, invoke } from "../src";
import type { CapabilityContext, WorkspaceRecord } from "../src";

const person: Actor = { type: "user", userId: "user-1", accountId: "account-1" };
const outsider: Actor = { type: "user", userId: "user-2", accountId: "account-2" };

const workspace: WorkspaceRecord = {
  id: "ws-1",
  name: "Product brief",
  accountId: "account-1",
  docRoomId: "doc-1",
  archived: false,
};

function context(actor: Actor, record: WorkspaceRecord = workspace): CapabilityContext {
  return {
    actor,
    workspaces: {
      findById: (id) => Promise.resolve(id === record.id ? record : null),
    },
    rooms: createInMemoryRoomOwner(),
  };
}

describe("doc.connection", () => {
  it("names the document room and allows a write on an active workspace", async () => {
    const result = await invoke(docConnection, context(person), { workspaceId: "ws-1" });

    expect(result).toEqual({ ok: true, documentName: "doc-1", readOnly: false });
  });

  it("makes an archived workspace read-only", async () => {
    const archived: WorkspaceRecord = { ...workspace, archived: true };

    const result = await invoke(docConnection, context(person, archived), {
      workspaceId: "ws-1",
    });

    expect(result).toEqual({ ok: true, documentName: "doc-1", readOnly: true });
  });

  it("reports another account's workspace as not found", async () => {
    const result = await invoke(docConnection, context(outsider), { workspaceId: "ws-1" });

    expect(result).toMatchObject({ ok: false, code: "not-found" });
  });

  it("is not offered to the agent", async () => {
    const agent: Actor = {
      type: "agent",
      runId: "run-1",
      accountId: "account-1",
      requestedByUserId: person.userId,
    };

    const result = await invoke(docConnection, context(agent), { workspaceId: "ws-1" });

    expect(result).toMatchObject({ ok: false, code: "not-a-caller" });
  });
});
