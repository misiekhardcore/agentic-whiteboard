import { afterEach, describe, expect, it, vi } from "vitest";

type ReadState = {
  account: unknown;
  access: unknown;
  row: unknown;
  config: unknown;
  object: unknown;
};

const state = vi.hoisted((): ReadState => ({
  account: null,
  access: null,
  row: null,
  config: null,
  object: null,
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
  createSupabaseMediaStorage: () => ({
    put: vi.fn(),
    get: () => Promise.resolve(state.object),
    remove: vi.fn(),
  }),
}));

vi.mock("@/lib/media/service", () => ({
  findMediaById: () => Promise.resolve(state.row),
  createMedia: vi.fn(),
}));

import type * as accessModule from "@/lib/workspace/access";

import { GET } from "./route";

const session = { session: { user: { id: "user_1" } }, activeOrganizationId: null };
const config = {
  supabaseUrl: "http://localhost:8000",
  serviceRoleKey: "service-role",
  bucket: "media",
};

const imageRow = {
  id: "media_1",
  uploadedByUserId: "user_1",
  workspaceId: "ws_roadmap",
  mimeType: "image/png",
  byteSize: 6,
  storageKey: "media_1",
};

function call(id = "media_1") {
  return GET(new Request(`http://localhost/api/media/${id}`), {
    params: Promise.resolve({ id }),
  });
}

afterEach(() => {
  state.account = null;
  state.access = null;
  state.row = null;
  state.config = null;
  state.object = null;
});

describe("the media read route", () => {
  it("refuses a caller with no session", async () => {
    expect((await call()).status).toBe(401);
  });

  it("answers 404 for a media id nobody stored", async () => {
    state.account = session;

    expect((await call("media_missing")).status).toBe(404);
  });

  it("answers 404 for a workspace's media when the caller cannot read the workspace", async () => {
    state.account = session;
    state.row = imageRow;
    state.config = config;

    expect((await call()).status).toBe(404);
  });

  it("answers 503 on a deployment that stores no media", async () => {
    state.account = session;
    state.access = {};
    state.row = imageRow;

    expect((await call()).status).toBe(503);
  });

  it("streams the stored object for someone who may read it", async () => {
    state.account = session;
    state.access = {};
    state.row = imageRow;
    state.config = config;
    state.object = { body: new Blob(["pixels"]).stream(), contentType: "image/png" };

    const response = await call();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("pixels");
  });

  it("answers 404 when the row names an object that is no longer there", async () => {
    state.account = session;
    state.access = {};
    state.row = imageRow;
    state.config = config;

    expect((await call()).status).toBe(404);
  });
});
