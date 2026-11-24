import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  events: [] as string[],
  failRemove: false,
}));

vi.mock("@/lib/db", () => ({
  db: {
    delete: () => ({
      where: () => {
        state.events.push("row");
        return Promise.resolve();
      },
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({ media: {} }));

import { deleteMedia } from "./deleteMedia";

function storage() {
  return {
    put: vi.fn(),
    get: vi.fn(),
    remove: vi.fn((key: string) => {
      if (state.failRemove) return Promise.reject(new Error("storage refused"));
      state.events.push(`object:${key}`);
      return Promise.resolve();
    }),
  };
}

afterEach(() => {
  state.events = [];
  state.failRemove = false;
});

describe("deleting a stored file", () => {
  it("removes the object before the row that names it", async () => {
    await deleteMedia({ storage: storage(), file: { id: "media_1", storageKey: "key_1" } });

    expect(state.events).toEqual(["object:key_1", "row"]);
  });

  it("keeps the row when the object cannot be removed", async () => {
    state.failRemove = true;

    await expect(
      deleteMedia({ storage: storage(), file: { id: "media_1", storageKey: "key_1" } }),
    ).rejects.toThrow("storage refused");

    expect(state.events).toEqual([]);
  });
});
