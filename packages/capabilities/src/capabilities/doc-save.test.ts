import type { Actor, DocProjection, RoomOwnerPort } from "@v2/contracts";
import { isDocProjection, RoomOwnerError } from "@v2/contracts";
import { createInMemoryRoomOwner } from "@v2/contracts/testing";
import { describe, expect, it } from "vitest";

import { docSave, invoke } from "../index";
import type { CapabilityContext, WorkspaceRecord } from "../index";

const person: Actor = { type: "user", userId: "user-1", accountId: "account-1" };
const outsider: Actor = { type: "user", userId: "user-2", accountId: "account-2" };

const workspace: WorkspaceRecord = {
  id: "ws-1",
  name: "Product brief",
  accountId: "account-1",
  docRoomId: "doc-1",
  archived: false,
};

const seedBlock = {
  id: "block-seed",
  kind: "paragraph",
  level: null,
  text: "Existing text",
  updatedBy: null,
};

function roomOwner(): RoomOwnerPort {
  return createInMemoryRoomOwner({
    rooms: [
      {
        room: { kind: "doc", id: workspace.docRoomId, accountId: workspace.accountId },
        content: { blocks: [seedBlock] } satisfies DocProjection,
        revision: "rev-1",
      },
    ],
  });
}

function context(
  actor: Actor,
  rooms: RoomOwnerPort,
  record: WorkspaceRecord = workspace,
): CapabilityContext {
  return {
    actor,
    workspaces: {
      findById: (id) => Promise.resolve(id === record.id ? record : null),
    },
    rooms,
  };
}

describe("doc.save", () => {
  it("saves the room and returns the revision it holds", async () => {
    const rooms = roomOwner();

    const result = await invoke(docSave, context(person, rooms), { workspaceId: "ws-1" });

    expect(result).toEqual({ ok: true, revision: "rev-1" });

    const snapshot = await rooms.snapshot({
      kind: "doc",
      id: workspace.docRoomId,
      accountId: workspace.accountId,
    });
    expect(isDocProjection(snapshot.content) && snapshot.content.blocks).toEqual([seedBlock]);
  });

  it("refuses an archived workspace before the room is asked to save", async () => {
    let saved = false;
    const guarded: RoomOwnerPort = {
      snapshot: () => Promise.reject(new RoomOwnerError("room-not-found", "No room")),
      apply: () => Promise.reject(new RoomOwnerError("apply-refused", "Must not run")),
      save: () => {
        saved = true;
        return Promise.resolve({ revision: "rev-1" });
      },
      revoke: () => Promise.resolve(),
    };

    const result = await invoke(
      docSave,
      context(person, guarded, { ...workspace, archived: true }),
      { workspaceId: "ws-1" },
    );

    expect(result).toMatchObject({ ok: false, code: "read-only" });
    expect(saved).toBe(false);
  });

  it("refuses someone who cannot write the document before anything is saved", async () => {
    let saved = false;
    const guarded: RoomOwnerPort = {
      snapshot: () => Promise.reject(new RoomOwnerError("room-not-found", "No room")),
      apply: () => Promise.reject(new RoomOwnerError("apply-refused", "Must not run")),
      save: () => {
        saved = true;
        return Promise.resolve({ revision: "rev-1" });
      },
      revoke: () => Promise.resolve(),
    };

    const result = await invoke(docSave, context(outsider, guarded), { workspaceId: "ws-1" });

    expect(result).toMatchObject({ ok: false, code: "not-found" });
    expect(saved).toBe(false);
  });

  it("reports an unreachable room owner as unavailable", async () => {
    const guarded: RoomOwnerPort = {
      snapshot: () => Promise.reject(new RoomOwnerError("room-not-found", "No room")),
      apply: () => Promise.reject(new RoomOwnerError("apply-refused", "Must not run")),
      save: () => Promise.reject(new RoomOwnerError("room-not-found", "No room")),
      revoke: () => Promise.resolve(),
    };

    const result = await invoke(docSave, context(person, guarded), { workspaceId: "ws-1" });

    expect(result).toMatchObject({ ok: false, code: "unavailable" });
  });
});
