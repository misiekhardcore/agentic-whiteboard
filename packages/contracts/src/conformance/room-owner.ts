import { describe, expect, it } from "vitest";

import type { Actor } from "../actor";
import type { JsonValue } from "../json";
import { RoomOwnerError } from "../room-owner";
import type { ContentOp, RoomOwnerErrorCode, RoomOwnerPort, RoomRef } from "../room-owner";

export type RoomOwnerFixture = {
  owner: RoomOwnerPort;
  room: RoomRef;
  actor: Actor;
  seedContent: JsonValue;
  applyOps: readonly ContentOp[];
  appliedContent: JsonValue;
  /** A batch the owner must reject as a whole. */
  invalidOps: readonly ContentOp[];
};

async function expectRefusal(promise: Promise<unknown>, code: RoomOwnerErrorCode): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(RoomOwnerError);
    expect((error as RoomOwnerError).code).toBe(code);
    return;
  }
  throw new Error(`Expected the room owner to refuse with ${code}`);
}

/**
 * The contract every room owner is held to, fake or real. `createFixture` is
 * called per test so one case cannot leak applied state into the next.
 */
export function describeRoomOwnerContract(
  name: string,
  createFixture: () => RoomOwnerFixture,
): void {
  describe(name, () => {
    it("returns the stored projection and its revision", async () => {
      const fixture = createFixture();
      const snapshot = await fixture.owner.snapshot(fixture.room);

      expect(snapshot.room).toEqual(fixture.room);
      expect(snapshot.content).toEqual(fixture.seedContent);
      expect(snapshot.revision.length).toBeGreaterThan(0);
    });

    it("applies a batch and advances the revision", async () => {
      const fixture = createFixture();
      const before = await fixture.owner.snapshot(fixture.room);

      const result = await fixture.owner.apply({
        room: fixture.room,
        actor: fixture.actor,
        idempotencyKey: "op-1",
        ops: fixture.applyOps,
      });

      expect(result.applied).toBe(fixture.applyOps.length);
      expect(result.revision).not.toBe(before.revision);

      const after = await fixture.owner.snapshot(fixture.room);
      expect(after.content).toEqual(fixture.appliedContent);
      expect(after.revision).toBe(result.revision);
    });

    it("records the actor that wrote the block", async () => {
      const fixture = createFixture();

      await fixture.owner.apply({
        room: fixture.room,
        actor: fixture.actor,
        idempotencyKey: "op-attribution",
        ops: fixture.applyOps,
      });

      const after = await fixture.owner.snapshot(fixture.room);
      expect(JSON.stringify(after.content)).toContain(
        fixture.actor.type === "user"
          ? `user:${fixture.actor.userId}`
          : `agent:${fixture.actor.runId}`,
      );
    });

    it("applies a replayed key zero times", async () => {
      const fixture = createFixture();
      const input = {
        room: fixture.room,
        actor: fixture.actor,
        idempotencyKey: "op-1",
        ops: fixture.applyOps,
      };

      const first = await fixture.owner.apply(input);
      const replay = await fixture.owner.apply(input);

      expect(replay.applied).toBe(0);
      expect(replay.revision).toBe(first.revision);
      await expect(fixture.owner.snapshot(fixture.room)).resolves.toMatchObject({
        content: fixture.appliedContent,
        revision: first.revision,
      });
    });

    it("applies nothing when a batch contains an invalid operation", async () => {
      const fixture = createFixture();
      const before = await fixture.owner.snapshot(fixture.room);

      await expectRefusal(
        fixture.owner.apply({
          room: fixture.room,
          actor: fixture.actor,
          idempotencyKey: "op-invalid",
          ops: fixture.invalidOps,
        }),
        "invalid-ops",
      );

      await expect(fixture.owner.snapshot(fixture.room)).resolves.toMatchObject({
        content: before.content,
        revision: before.revision,
      });
    });

    it("refuses writes after revoke but keeps the content readable", async () => {
      const fixture = createFixture();
      await fixture.owner.revoke(fixture.room);

      await expectRefusal(
        fixture.owner.apply({
          room: fixture.room,
          actor: fixture.actor,
          idempotencyKey: "op-after-revoke",
          ops: fixture.applyOps,
        }),
        "room-revoked",
      );

      await expect(fixture.owner.snapshot(fixture.room)).resolves.toMatchObject({
        content: fixture.seedContent,
      });
    });

    it("reports a room it does not hold", async () => {
      const fixture = createFixture();
      const missing: RoomRef = { ...fixture.room, id: `${fixture.room.id}-missing` };

      await expectRefusal(fixture.owner.snapshot(missing), "room-not-found");
      await expectRefusal(
        fixture.owner.apply({
          room: missing,
          actor: fixture.actor,
          idempotencyKey: "op-missing",
          ops: fixture.applyOps,
        }),
        "room-not-found",
      );
    });
  });
}
