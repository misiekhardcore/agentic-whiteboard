import type { Actor, DocProjection, RoomOwnerPort } from "@v2/contracts";
import { isDocProjection, RoomOwnerError } from "@v2/contracts";
import { createInMemoryRoomOwner } from "@v2/contracts/testing";
import { describe, expect, it } from "vitest";

import { docAppend, docReplace, invoke } from "../src";
import type { CapabilityContext, WorkspaceRecord } from "../src";

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

async function blocksOf(rooms: RoomOwnerPort): Promise<DocProjection["blocks"]> {
  const snapshot = await rooms.snapshot({
    kind: "doc",
    id: workspace.docRoomId,
    accountId: workspace.accountId,
  });
  if (!isDocProjection(snapshot.content)) throw new Error("expected a document projection");
  return snapshot.content.blocks;
}

const template = { kind: "paragraph" as const, level: null, text: "Inserted from template" };

describe("doc.append", () => {
  it("appends a block and records the person who wrote it", async () => {
    const rooms = roomOwner();

    const result = await invoke(docAppend, context(person, rooms), {
      workspaceId: "ws-1",
      idempotencyKey: "tpl-1",
      block: template,
    });

    expect(result).toEqual({
      ok: true,
      revision: "rev-2",
      applied: 1,
      blockId: "block_tpl-1",
    });

    const blocks = await blocksOf(rooms);
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toEqual({
      id: "block_tpl-1",
      kind: "paragraph",
      level: null,
      text: "Inserted from template",
      updatedBy: "user:user-1",
    });
  });

  it("applies a replayed request zero times and returns the first revision", async () => {
    const rooms = roomOwner();
    const input = {
      workspaceId: "ws-1",
      idempotencyKey: "tpl-1",
      block: template,
    };

    const first = await invoke(docAppend, context(person, rooms), input);
    const replay = await invoke(docAppend, context(person, rooms), input);

    if (!first.ok || !replay.ok) throw new Error("expected both calls to succeed");

    expect(replay.applied).toBe(0);
    expect(replay.revision).toBe(first.revision);
    expect(await blocksOf(rooms)).toHaveLength(2);
  });

  it("refuses an archived workspace before the room is asked to write", async () => {
    let applied = false;
    const guarded: RoomOwnerPort = {
      snapshot: () => Promise.reject(new RoomOwnerError("room-not-found", "No room")),
      apply: () => {
        applied = true;
        return Promise.reject(new RoomOwnerError("apply-refused", "Must not run"));
      },
      revoke: () => Promise.resolve(),
    };

    const result = await invoke(
      docAppend,
      context(person, guarded, { ...workspace, archived: true }),
      { workspaceId: "ws-1", idempotencyKey: "tpl-1", block: template },
    );

    expect(result).toMatchObject({ ok: false, code: "read-only" });
    expect(applied).toBe(false);
  });

  it("refuses someone who cannot read the document before anything is applied", async () => {
    let applied = false;
    const guarded: RoomOwnerPort = {
      snapshot: () => Promise.reject(new RoomOwnerError("room-not-found", "No room")),
      apply: () => {
        applied = true;
        return Promise.reject(new RoomOwnerError("apply-refused", "Must not run"));
      },
      revoke: () => Promise.resolve(),
    };

    const result = await invoke(docAppend, context(outsider, guarded), {
      workspaceId: "ws-1",
      idempotencyKey: "tpl-1",
      block: template,
    });

    expect(result).toMatchObject({ ok: false, code: "not-found" });
    expect(applied).toBe(false);
  });

  it("behaves the same for a person and an agent, except for the recorded actor", async () => {
    const personRooms = roomOwner();
    const agentRooms = roomOwner();
    const input = { workspaceId: "ws-1", idempotencyKey: "tpl-1", block: template };

    const asPerson = await invoke(docAppend, context(person, personRooms), input);
    const asAgent = await invoke(docAppend, context(agent, agentRooms), input);

    expect(asPerson).toEqual(asAgent);

    const [personBlock] = (await blocksOf(personRooms)).slice(-1);
    const [agentBlock] = (await blocksOf(agentRooms)).slice(-1);

    expect(personBlock).toEqual({ ...agentBlock, updatedBy: "user:user-1" });
    expect(agentBlock?.updatedBy).toBe("agent:run-1");
  });
});

describe("doc.replace", () => {
  it("replaces a block in place without changing its identity", async () => {
    const rooms = roomOwner();

    const appended = await invoke(docAppend, context(person, rooms), {
      workspaceId: "ws-1",
      idempotencyKey: "tpl-1",
      block: template,
    });
    if (!appended.ok) throw new Error("expected the append to succeed");

    const result = await invoke(docReplace, context(person, rooms), {
      workspaceId: "ws-1",
      idempotencyKey: "tpl-2",
      blockId: appended.blockId,
      block: { kind: "heading", level: 2, text: "Replaced from template" },
    });

    expect(result).toMatchObject({ ok: true, applied: 1, blockId: appended.blockId });

    const blocks = await blocksOf(rooms);
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toEqual({
      id: appended.blockId,
      kind: "heading",
      level: 2,
      text: "Replaced from template",
      updatedBy: "user:user-1",
    });
  });

  it("refuses an archived workspace before the room is asked to write", async () => {
    let applied = false;
    const guarded: RoomOwnerPort = {
      snapshot: () => Promise.reject(new RoomOwnerError("room-not-found", "No room")),
      apply: () => {
        applied = true;
        return Promise.reject(new RoomOwnerError("apply-refused", "Must not run"));
      },
      revoke: () => Promise.resolve(),
    };

    const result = await invoke(
      docReplace,
      context(person, guarded, { ...workspace, archived: true }),
      {
        workspaceId: "ws-1",
        idempotencyKey: "tpl-2",
        blockId: seedBlock.id,
        block: template,
      },
    );

    expect(result).toMatchObject({ ok: false, code: "read-only" });
    expect(applied).toBe(false);
  });

  it("refuses someone who cannot write the document before anything is applied", async () => {
    let applied = false;
    const guarded: RoomOwnerPort = {
      snapshot: () => Promise.reject(new RoomOwnerError("room-not-found", "No room")),
      apply: () => {
        applied = true;
        return Promise.reject(new RoomOwnerError("apply-refused", "Must not run"));
      },
      revoke: () => Promise.resolve(),
    };

    const result = await invoke(docReplace, context(outsider, guarded), {
      workspaceId: "ws-1",
      idempotencyKey: "tpl-2",
      blockId: seedBlock.id,
      block: template,
    });

    expect(result).toMatchObject({ ok: false, code: "not-found" });
    expect(applied).toBe(false);
  });
});
