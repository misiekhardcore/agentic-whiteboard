import type { CapabilityContext, WorkspaceRecord } from "@v2/capabilities";
import type { Actor, RoomOwnerPort } from "@v2/contracts";
import { isDocProjection } from "@v2/contracts";
import { createInMemoryRoomOwner } from "@v2/contracts/testing";
import { describe, expect, it } from "vitest";

import { insertTemplateBlock } from "./doc-write";

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
  const rooms: RoomOwnerPort = createInMemoryRoomOwner({
    rooms: [
      {
        room: { kind: "doc", id: record.docRoomId, accountId: record.accountId },
        content: { blocks: [] },
        revision: "rev-1",
      },
    ],
  });

  return {
    actor,
    workspaces: { findById: (id) => Promise.resolve(id === record.id ? record : null) },
    rooms,
  };
}

describe("insertTemplateBlock", () => {
  it("inserts the fixed template block and replays without a duplicate", async () => {
    const dependencies = context(person);

    const first = await insertTemplateBlock({
      workspaceId: "ws-1",
      idempotencyKey: "template-1",
      context: dependencies,
    });
    const replay = await insertTemplateBlock({
      workspaceId: "ws-1",
      idempotencyKey: "template-1",
      context: dependencies,
    });

    expect(first).toMatchObject({ ok: true, applied: 1 });
    expect(replay).toMatchObject({ ok: true, applied: 0 });

    const snapshot = await dependencies.rooms.snapshot({
      kind: "doc",
      id: "doc-1",
      accountId: "account-1",
    });
    if (!isDocProjection(snapshot.content)) throw new Error("expected a projection");

    expect(snapshot.content.blocks).toEqual([
      {
        id: "block_template-1",
        kind: "paragraph",
        level: null,
        text: "Inserted from template",
        updatedBy: "user:user-1",
      },
    ]);
  });

  it("refuses the template control on an archived workspace", async () => {
    const result = await insertTemplateBlock({
      workspaceId: "ws-1",
      idempotencyKey: "template-1",
      context: context(person, { ...workspace, archived: true }),
    });

    expect(result).toMatchObject({ ok: false, code: "read-only" });
  });

  it("refuses a workspace in another account", async () => {
    const result = await insertTemplateBlock({
      workspaceId: "ws-1",
      idempotencyKey: "template-1",
      context: context(outsider),
    });

    expect(result).toMatchObject({ ok: false, code: "not-found" });
  });
});
