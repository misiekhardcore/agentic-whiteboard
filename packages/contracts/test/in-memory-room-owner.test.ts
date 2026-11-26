import type { RoomRef } from "../src";
import { describeRoomOwnerContract } from "../src/conformance";
import { createInMemoryRoomOwner } from "../src/testing";

const room: RoomRef = { kind: "doc", id: "doc-1", accountId: "account-1" };

describeRoomOwnerContract("the in-memory room owner", () => ({
  owner: createInMemoryRoomOwner({
    rooms: [{ room, content: { title: "Product brief" }, revision: "rev-1" }],
  }),
  room,
  actor: { type: "user", userId: "user-1", accountId: "account-1" },
  seedContent: { title: "Product brief" },
  applyOps: [{ kind: "replace", payload: { title: "Reviewed brief" } }],
  appliedContent: { title: "Reviewed brief" },
  invalidOps: [{ kind: "unknown-op", payload: {} }],
}));
