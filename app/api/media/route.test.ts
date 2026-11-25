import { afterEach, describe, expect, it, vi } from "vitest";

type UploadState = {
  account: unknown;
  workspaceAccess: unknown;
  config: unknown;
  stored: Record<string, unknown>[];
  storage: { put: unknown; get: unknown; remove: unknown };
};

const state = vi.hoisted((): UploadState => ({
  account: null,
  workspaceAccess: null,
  config: null,
  stored: [],
  storage: { put: vi.fn(), get: vi.fn(), remove: vi.fn() },
}));

vi.mock("@/lib/identity/account", () => ({
  getSessionAccount: () => Promise.resolve(state.account),
}));

vi.mock("@/lib/workspace/access", async (importOriginal) => ({
  ...(await importOriginal<typeof accessModule>()),
  getWorkspaceForUser: () => Promise.resolve(state.workspaceAccess),
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

const session = { session: { user: { id: "user_1" } }, activeOrganizationId: "org_acme" };

const config = {
  storageUrl: "http://localhost:8000",
  serviceRoleKey: "service-role",
  bucket: "media",
};

const personalBoard = {
  workspace: { id: "ws_1", orgId: null, archivedAt: null },
  kind: "personal",
  organizationId: null,
  role: "owner",
};

const teamBoard = {
  ...personalBoard,
  workspace: { id: "ws_1", orgId: "org_acme", archivedAt: null },
};

function upload(body: FormData) {
  return POST(new Request("http://localhost/api/media", { method: "POST", body }));
}

function form({
  file = new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" }),
  workspaceId = "ws_1",
}: { file?: File; workspaceId?: string | null } = {}) {
  const data = new FormData();
  if (workspaceId) data.set("workspaceId", workspaceId);
  data.set("file", file);
  return data;
}

const storedMedia = {
  uploadedByUserId: "user_1",
  contentType: "image/png",
  byteSize: 3,
  storage: state.storage,
};

afterEach(() => {
  state.account = null;
  state.workspaceAccess = null;
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

  it("refuses an upload that names no workspace", async () => {
    state.account = session;
    state.config = config;

    const response = await upload(form({ workspaceId: null }));

    expect(response.status).toBe(400);
    expect(state.stored).toEqual([]);
  });

  it("refuses an upload with an invalid file type", async () => {
    state.account = session;
    state.workspaceAccess = personalBoard;
    state.config = config;

    const response = await upload(
      form({ file: new File([new Uint8Array([1])], "notes.pdf", { type: "application/pdf" }) }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("image");
    expect(state.stored).toEqual([]);
  });

  it("answers 404 for a workspace the caller cannot reach", async () => {
    state.account = session;
    state.config = config;

    expect((await upload(form())).status).toBe(404);
    expect(state.stored).toEqual([]);
  });

  it("refuses an upload into an archived workspace", async () => {
    state.account = session;
    state.workspaceAccess = {
      ...teamBoard,
      workspace: { id: "ws_1", orgId: "org_acme", archivedAt: new Date() },
    };
    state.config = config;

    expect((await upload(form())).status).toBe(403);
    expect(state.stored).toEqual([]);
  });

  it("refuses an upload on a deployment that stores no media", async () => {
    state.account = session;
    state.workspaceAccess = personalBoard;

    const response = await upload(form());

    expect(response.status).toBe(503);
    expect(state.stored).toEqual([]);
  });

  it("stores the file under the board's account and answers with its address", async () => {
    state.account = session;
    state.workspaceAccess = teamBoard;
    state.config = config;

    const response = await upload(form());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "media_1", url: "/api/media/media_1" });
    expect(state.stored[0]).toMatchObject({ ...storedMedia, organizationId: "org_acme" });
    expect(state.stored[0]?.body).toBeInstanceOf(ArrayBuffer);
  });

  it("scopes a personal board's file to its uploader alone", async () => {
    state.account = session;
    state.workspaceAccess = personalBoard;
    state.config = config;

    expect((await upload(form())).status).toBe(201);
    expect(state.stored[0]).toMatchObject({ organizationId: null });
  });
});
