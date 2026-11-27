import type { Actor, DocProjection, RoomOwnerPort } from "@v2/contracts";
import { RoomOwnerError } from "@v2/contracts";
import { createInMemoryRoomOwner } from "@v2/contracts/testing";
import { describe, expect, it } from "vitest";

import { docRead, invoke } from "../index";
import type { CapabilityContext, WorkspaceRecord } from "../index";

const person: Actor = { type: "user", userId: "user-1", accountId: "account-1" };
const outsider: Actor = { type: "user", userId: "user-2", accountId: "account-2" };
const agent: Actor = {
  type: "agent",
  runId: "run-1",
  accountId: "account-1",
  requestedByUserId: "user-1",
};

const workspace: WorkspaceRecord = {
  id: "ws-1",
  name: "Product brief",
  accountId: "account-1",
  docRoomId: "doc-1",
  archived: false,
};

const projection: DocProjection = {
  blocks: [
    { id: "block-1", kind: "paragraph", level: null, text: "Product brief", updatedBy: null },
    { id: "block-2", kind: "heading", level: 2, text: "Risks", updatedBy: null },
    {
      id: "block-3",
      kind: "paragraph",
      level: null,
      text: "Budget and delivery risks",
      updatedBy: null,
    },
  ],
};

function context(actor: Actor, rooms?: RoomOwnerPort): CapabilityContext {
  return {
    actor,
    workspaces: {
      findById: (id) => Promise.resolve(id === workspace.id ? workspace : null),
    },
    rooms:
      rooms ??
      createInMemoryRoomOwner({
        rooms: [
          {
            room: { kind: "doc", id: workspace.docRoomId, accountId: workspace.accountId },
            content: projection,
            revision: "rev-4",
          },
        ],
      }),
  };
}

describe("doc.read", () => {
  it("returns the outline with the room's revision", async () => {
    const result = await invoke(docRead, context(person), {
      workspaceId: "ws-1",
      view: { kind: "outline" },
    });

    expect(result).toEqual({ ok: true, revision: "rev-4", blocks: projection.blocks });
  });

  it("returns a range addressed by block identity", async () => {
    const result = await invoke(docRead, context(person), {
      workspaceId: "ws-1",
      view: { kind: "range", fromBlockId: "block-2", toBlockId: "block-3" },
    });

    expect(result).toMatchObject({
      ok: true,
      blocks: [{ id: "block-2" }, { id: "block-3" }],
    });
  });

  it("refuses a range whose block is no longer in the document", async () => {
    const result = await invoke(docRead, context(person), {
      workspaceId: "ws-1",
      view: { kind: "range", fromBlockId: "block-missing", toBlockId: "block-3" },
    });

    expect(result).toMatchObject({ ok: false, code: "not-found" });
  });

  it("searches block text case-insensitively", async () => {
    const result = await invoke(docRead, context(person), {
      workspaceId: "ws-1",
      view: { kind: "search", query: "RISK" },
    });

    expect(result).toMatchObject({ ok: true, blocks: [{ id: "block-2" }, { id: "block-3" }] });
  });

  it("lets an agent read the same document", async () => {
    const result = await invoke(docRead, context(agent), {
      workspaceId: "ws-1",
      view: { kind: "outline" },
    });

    expect(result).toMatchObject({ ok: true, revision: "rev-4" });
  });

  it("refuses a reader from another account", async () => {
    const result = await invoke(docRead, context(outsider), {
      workspaceId: "ws-1",
      view: { kind: "outline" },
    });

    expect(result).toMatchObject({ ok: false, code: "not-found" });
  });

  it("reports an unreachable room owner as unavailable", async () => {
    const unavailable: RoomOwnerPort = {
      snapshot: () => Promise.reject(new RoomOwnerError("room-not-found", "No room")),
      apply: () => Promise.reject(new RoomOwnerError("apply-refused", "No room")),
      revoke: () => Promise.resolve(),
    };

    const result = await invoke(docRead, context(person, unavailable), {
      workspaceId: "ws-1",
      view: { kind: "outline" },
    });

    expect(result).toMatchObject({ ok: false, code: "unavailable" });
  });
});
