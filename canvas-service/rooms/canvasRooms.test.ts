import type { WebSocketMinimal } from "@tldraw/sync-core";
import { describe, expect, it, vi } from "vitest";

import { createCanvasRooms } from "./canvasRooms";

const workspaceId = "wsone9k2m4p7q1r3s5t8u0vx";
const otherWorkspaceId = "wsother9k2m4p7q1r3s5t8u0";

/** The room only needs to close a session's socket, never read it. */
function socket(): WebSocketMinimal & { close: () => void } {
  return { send: () => undefined, close: vi.fn(), readyState: 1 };
}

function roomsRecordingLoads() {
  const loads: string[] = [];
  const rooms = createCanvasRooms({
    load: (id) => {
      loads.push(id);
      return Promise.resolve({ revision: 0, snapshot: null });
    },
    save: () => Promise.resolve({ ok: true, revision: 1 }),
    log: () => undefined,
  });

  return { loads, rooms };
}

describe("the canvas room registry", () => {
  it("hands every session the room that already holds the canvas", async () => {
    const { loads, rooms } = roomsRecordingLoads();

    const first = await rooms.open(workspaceId);
    const second = await rooms.open(workspaceId);

    expect(second).toBe(first);
    expect(loads).toEqual([workspaceId]);
    await rooms.shutdown();
  });

  it("loads a canvas once when two sessions race to open it", async () => {
    const { loads, rooms } = roomsRecordingLoads();

    const [first, second] = await Promise.all([rooms.open(workspaceId), rooms.open(workspaceId)]);

    expect(second).toBe(first);
    expect(loads).toEqual([workspaceId]);
    await rooms.shutdown();
  });

  it("loads each canvas separately", async () => {
    const { loads, rooms } = roomsRecordingLoads();

    await rooms.open(workspaceId);
    await rooms.open(otherWorkspaceId);

    expect(loads).toEqual([workspaceId, otherWorkspaceId]);
    await rooms.shutdown();
  });

  it("closes the open sessions on revoke, and the next open loads the stored canvas", async () => {
    const { loads, rooms } = roomsRecordingLoads();
    const session = socket();

    const room = await rooms.open(workspaceId);
    room.join({ sessionId: "tab_one", socket: session, readOnly: false });

    await rooms.revoke(workspaceId);

    expect(session.close).toHaveBeenCalled();
    await rooms.open(workspaceId);
    expect(loads).toEqual([workspaceId, workspaceId]);
    await rooms.shutdown();
  });

  it("keeps no half-open room when the snapshot cannot be loaded", async () => {
    const loads: string[] = [];
    let fail = true;
    const rooms = createCanvasRooms({
      load: (id) => {
        loads.push(id);
        if (fail) return Promise.reject(new Error("the app is unreachable"));
        return Promise.resolve({ revision: 0, snapshot: null });
      },
      save: () => Promise.resolve({ ok: true, revision: 1 }),
      log: () => undefined,
    });

    await expect(rooms.open(workspaceId)).rejects.toThrow("the app is unreachable");

    fail = false;
    await expect(rooms.open(workspaceId)).resolves.toBeDefined();
    expect(loads).toEqual([workspaceId, workspaceId]);
    await rooms.shutdown();
  });
});
