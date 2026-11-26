import type { ContentOp, DocProjection, RoomRef } from "../src";
import { describeRoomOwnerContract } from "../src/conformance";
import { createInMemoryRoomOwner } from "../src/testing";

const room: RoomRef = { kind: "doc", id: "doc-1", accountId: "account-1" };

const seedBlock = {
  id: "block-1",
  kind: "paragraph",
  level: null,
  text: "Product brief",
  updatedBy: null,
};

const seed: DocProjection = { blocks: [seedBlock] };

const applyOps: ContentOp[] = [
  {
    kind: "append-block",
    payload: {
      block: { id: "block-2", kind: "paragraph", level: null, text: "Reviewed brief" },
    },
  },
];

const invalidOps: ContentOp[] = [
  {
    kind: "append-block",
    payload: {
      block: { id: "block-3", kind: "paragraph", level: null, text: "Must not land" },
    },
  },
  {
    kind: "replace-block",
    payload: {
      blockId: "block-missing",
      block: { id: "block-missing", kind: "paragraph", level: null, text: "No target" },
    },
  },
];

describeRoomOwnerContract("the in-memory room owner", () => ({
  owner: createInMemoryRoomOwner({
    rooms: [{ room, content: seed, revision: "rev-1" }],
  }),
  room,
  actor: { type: "user", userId: "user-1", accountId: "account-1" },
  seedContent: seed,
  applyOps,
  appliedContent: {
    blocks: [
      seedBlock,
      {
        id: "block-2",
        kind: "paragraph",
        level: null,
        text: "Reviewed brief",
        updatedBy: "user:user-1",
      },
    ],
  },
  invalidOps,
}));
