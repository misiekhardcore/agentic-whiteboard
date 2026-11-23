import { afterEach, describe, expect, it, vi } from "vitest";

type UploadState = {
  account: unknown;
  access: unknown;
  config: unknown;
  stored: Record<string, unknown>[];
  storage: { put: unknown; get: unknown; remove: unknown };
};

const state = vi.hoisted((): UploadState => ({
  account: null,
  access: null,
  config: null,
  stored: [],
  storage: { put: vi.fn(), get: vi.fn(), remove: vi.fn() },
}));

vi.mock("@/lib/identity/account", () => ({
  getSessionAccount: () => Promise.resolve(state.account),
}));

vi.mock("@/lib/workspace/access", async (importOriginal) => ({
  ...(await importOriginal<typeof accessModule>()),
  getWorkspaceForUser: () => Promise.resolve(state.access),
}));

vi.mock("@/lib/media/config", () => ({
  resolveMediaConfig: () => state.config,
}));

vi.mock("@/lib/media/storage", () => ({
  createSupabaseMediaStorage: () => state.storage,
}));

vi.mock("@/lib/media/service", () => ({
  createMedia: (input: Record<string, unknown>) => {
    state.stored.push(input);
    return Promise.resolve({ id: "media_1" });
  },
  findMediaById: () => Promise.resolve(null),
}));

import type * as accessModule from "@/lib/workspace/access";

import { POST } from "./route";

const session = { session: { user: { id: "user_1" } }, activeOrganizationId: null };

const config = {
  supabaseUrl: "http://localhost:8000",
  serviceRoleKey: "service-role",
  bucket: "media",
};

function upload(body: FormData) {
  return POST(new Request("http://localhost/api/media", { method: "POST", body }));
}

function form({
  file = new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" }),
  targetWorkspace,
}: {
  file?: File;
  targetWorkspace?: string | null;
} = {}) {
  const data = new FormData();
  if (targetWorkspace) data.set("workspaceId", targetWorkspace);
  if (file) data.set("file", file);
  return data;
}

afterEach(() => {
  state.account = null;
  state.access = null;
  state.config = null;
  state.stored = [];
  vi.clearAllMocks();
});

describe("the media upload route", () => {
  it("refuses a caller with no session", async () => {
    const response = await upload(form());

    expect(response.status).toBe(401);
    expect(state.stored).toEqual([]);
  });

  it("refuses an upload with an invalid file type", async () => {
    state.account = session;
    state.config = config;

    const response = await upload(
      form({ file: new File([new Uint8Array([1])], "notes.pdf", { type: "application/pdf" }) }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("image");
    expect(state.stored).toEqual([]);
  });

  it("refuses an upload on a deployment that stores no media", async () => {
    state.account = session;
    state.access = {};

    const response = await upload(form());

    expect(response.status).toBe(503);
    expect(state.stored).toEqual([]);
  });

  it("stores the file and answers with its address", async () => {
    state.account = session;
    state.config = config;

    const response = await upload(form());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "media_1", url: "/api/media/media_1" });
    expect(state.stored[0]).toMatchObject({
      uploadedByUserId: "user_1",
      contentType: "image/png",
      byteSize: 3,
      storage: state.storage,
    });
  });

  it("stores a file when targetWorkspace is null (unattached)", async () => {
    state.account = session;
    state.config = config;

    const response = await upload(form({ targetWorkspace: null }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "media_1", url: "/api/media/media_1" });
    expect(state.stored[0]).toMatchObject({
      uploadedByUserId: "user_1",
      contentType: "image/png",
      byteSize: 3,
      storage: state.storage,
    });
  });
});
