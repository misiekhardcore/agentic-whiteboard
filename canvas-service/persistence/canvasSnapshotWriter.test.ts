import { afterEach, describe, expect, it, vi } from "vitest";

import type { CanvasSnapshot, CanvasSnapshotWriteResult } from "@/lib/canvas/contracts";

import { createCanvasSnapshotWriter } from "./canvasSnapshotWriter";
import { SNAPSHOT_DEBOUNCE_MS, SNAPSHOT_RETRY_MS } from "./constants";

const first: CanvasSnapshot = {
  clock: 3,
  documents: [{ lastChangedClock: 3, state: { id: "shape:first" } }],
};

const second: CanvasSnapshot = {
  clock: 8,
  documents: [{ lastChangedClock: 8, state: { id: "shape:second" } }],
};

function recordingSave(results: Array<CanvasSnapshotWriteResult | Error>) {
  const writes: Array<{ revision: number; snapshot: CanvasSnapshot }> = [];

  return {
    writes,
    save: (input: {
      revision: number;
      snapshot: CanvasSnapshot;
    }): Promise<CanvasSnapshotWriteResult> => {
      writes.push(input);
      const next = results.shift();
      if (next instanceof Error) return Promise.reject(next);

      return Promise.resolve(next ?? { ok: true, revision: input.revision + 1 });
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the canvas snapshot writer", () => {
  it("writes once after the debounce, naming the revision the room loaded", async () => {
    vi.useFakeTimers();
    const { writes, save } = recordingSave([]);
    const writer = createCanvasSnapshotWriter({ initialRevision: 4, save });

    writer.record(first);
    expect(writes).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(SNAPSHOT_DEBOUNCE_MS);

    expect(writes).toEqual([{ revision: 4, snapshot: first }]);
    expect(writer.revision()).toBe(5);
  });

  it("coalesces changes into one write of the newest snapshot", async () => {
    vi.useFakeTimers();
    const { writes, save } = recordingSave([]);
    const writer = createCanvasSnapshotWriter({ initialRevision: 0, save });

    writer.record(first);
    writer.record(second);
    await vi.advanceTimersByTimeAsync(SNAPSHOT_DEBOUNCE_MS);

    expect(writes).toEqual([{ revision: 0, snapshot: second }]);
  });

  it("catches up from the revision that refused a stale write", async () => {
    vi.useFakeTimers();
    const { writes, save } = recordingSave([
      { ok: false, currentRevision: 8 },
      { ok: true, revision: 9 },
    ]);
    const writer = createCanvasSnapshotWriter({ initialRevision: 3, save });

    writer.record(first);
    await vi.advanceTimersByTimeAsync(SNAPSHOT_DEBOUNCE_MS);
    await vi.advanceTimersByTimeAsync(1);

    expect(writes.map((write) => write.revision)).toEqual([3, 8]);
    expect(writer.revision()).toBe(9);
  });

  it("retries a write the app could not take instead of dropping the snapshot", async () => {
    vi.useFakeTimers();
    const { writes, save } = recordingSave([new Error("app is restarting")]);
    const writer = createCanvasSnapshotWriter({ initialRevision: 1, save });

    writer.record(first);
    await vi.advanceTimersByTimeAsync(SNAPSHOT_DEBOUNCE_MS);
    expect(writes).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(SNAPSHOT_RETRY_MS);

    expect(writes).toHaveLength(2);
    expect(writes[1]).toEqual({ revision: 1, snapshot: first });
  });

  it("writes a pending snapshot on flush, before the room is evicted", async () => {
    vi.useFakeTimers();
    const { writes, save } = recordingSave([]);
    const writer = createCanvasSnapshotWriter({ initialRevision: 2, save });

    writer.record(second);
    await writer.flush();

    expect(writes).toEqual([{ revision: 2, snapshot: second }]);
  });
});
