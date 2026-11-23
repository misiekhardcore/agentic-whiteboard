import { describe, expect, it, vi } from "vitest";

/**
 * The write names the revision it expects and the update only matches that
 * revision, so a stale writer changes nothing. The mock returns the row the
 * database would return: one for an applied write, none for a stale one.
 */
const state = vi.hoisted(() => ({
  updated: [] as Array<{ revision: number }>,
  current: [] as Array<{ revision: number }>,
  sets: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: () => ({
      set: (values: Record<string, unknown>) => {
        state.sets.push(values);
        return {
          where: () => ({
            returning: () => Promise.resolve(state.updated),
          }),
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(state.current),
        }),
      }),
    }),
  },
}));

import type { CanvasSnapshot } from "@/lib/canvas/contracts";

import { saveCanvasSnapshot } from "./saveCanvasSnapshot";

const snapshot: CanvasSnapshot = {
  clock: 7,
  documents: [{ lastChangedClock: 7, state: { id: "shape:one", typeName: "shape" } }],
};

const workspaceId = "wsone9k2m4p7q1r3s5t8u0vx";

describe("saving a canvas snapshot", () => {
  it("writes the snapshot and advances the revision it expected", async () => {
    state.updated = [{ revision: 5 }];
    state.sets = [];

    await expect(
      saveCanvasSnapshot({ workspaceId, expectedRevision: 4, snapshot }),
    ).resolves.toEqual({
      ok: true,
      revision: 5,
    });
    expect(state.sets[0]).toMatchObject({ content: snapshot });
  });

  it("refuses a stale write and reports the revision that is stored", async () => {
    state.updated = [];
    state.current = [{ revision: 9 }];

    await expect(
      saveCanvasSnapshot({ workspaceId, expectedRevision: 4, snapshot }),
    ).resolves.toEqual({
      ok: false,
      currentRevision: 9,
    });
  });

  it("reports a missing canvas row rather than inventing a revision", async () => {
    state.updated = [];
    state.current = [];

    await expect(
      saveCanvasSnapshot({ workspaceId, expectedRevision: 0, snapshot }),
    ).resolves.toEqual({
      ok: false,
      currentRevision: null,
    });
  });
});
