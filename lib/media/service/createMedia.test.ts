import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  failInsert: false,
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        if (state.failInsert) return Promise.reject(new Error("insert failed"));
        state.rows.push(values);
        return Promise.resolve();
      },
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({ media: {} }));

import { createMedia } from "./createMedia";

const body = new TextEncoder().encode("pixels").buffer;

function storage() {
  return {
    put: vi
      .fn<(input: { key: string; body: ArrayBuffer; contentType: string }) => Promise<void>>()
      .mockResolvedValue(undefined),
    get: vi.fn(),
    remove: vi.fn<(key: string) => Promise<void>>().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  state.rows = [];
});

describe("storing a media object", () => {
  it("writes the object first, then the row that names it", async () => {
    const objects = storage();

    const created = await createMedia({
      storage: objects,
      uploadedByUserId: "user_1",
      organizationId: "org_acme",
      contentType: "image/png",
      byteSize: body.byteLength,
      body,
    });

    expect(objects.put).toHaveBeenCalledWith({
      key: created.id,
      body,
      contentType: "image/png",
    });
    expect(state.rows[0]).toMatchObject({
      id: created.id,
      uploadedByUserId: "user_1",
      orgId: "org_acme",
      mimeType: "image/png",
      byteSize: body.byteLength,
      storageKey: created.id,
    });
  });

  it("records a personal file with no account", async () => {
    await createMedia({
      storage: storage(),
      uploadedByUserId: "user_1",
      organizationId: null,
      contentType: "image/png",
      byteSize: body.byteLength,
      body,
    });

    expect(state.rows[0]).toMatchObject({ orgId: null });
  });

  it("removes the object it just wrote when the row cannot be stored", async () => {
    const objects = storage();
    state.failInsert = true;

    await expect(
      createMedia({
        storage: objects,
        uploadedByUserId: "user_1",
        organizationId: null,
        contentType: "image/png",
        byteSize: body.byteLength,
        body,
      }),
    ).rejects.toThrow("insert failed");

    expect(objects.remove).toHaveBeenCalledWith(objects.put.mock.calls[0]?.[0].key);
    state.failInsert = false;
  });
});
