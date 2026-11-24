import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type UploadState = {
  account: unknown;
  workspaceAccess: unknown;
  inserted: Record<string, unknown>[];
  requests: { method: string; url: string }[];
};

const state = vi.hoisted((): UploadState => ({
  account: null,
  workspaceAccess: null,
  inserted: [],
  requests: [],
}));

vi.mock("@/lib/identity/account", () => ({
  getSessionAccount: () => Promise.resolve(state.account),
}));

vi.mock("@/lib/workspace/access", async (importOriginal) => ({
  ...(await importOriginal<typeof accessModule>()),
  getWorkspaceForUser: () => Promise.resolve(state.workspaceAccess),
}));

// The row write is the one thing a unit test cannot do; everything else in the
// upload - the store, the adapter, the rules - runs for real.
vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        state.inserted.push(row);
        return Promise.resolve();
      },
    }),
  },
}));

import type * as accessModule from "@/lib/workspace/access";

import { POST } from "./route";

const session = { session: { user: { id: "user_1" } }, activeOrganizationId: "org_acme" };

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

const fakeFetch = vi.fn((url: string | URL, init?: RequestInit) => {
  state.requests.push({ method: init?.method ?? "GET", url: String(url) });

  return Promise.resolve(new Response(null, { status: 200 }));
});

/** The two settings a deployment needs before it stores anything. */
function storeMedia() {
  vi.stubEnv("MEDIA_STORAGE_URL", "http://storage.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
}

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

beforeEach(() => {
  vi.stubEnv("MEDIA_STORAGE_URL", "");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubGlobal("fetch", fakeFetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  state.account = null;
  state.workspaceAccess = null;
  state.inserted = [];
  state.requests = [];
  vi.clearAllMocks();
});

describe("the media upload route", () => {
  it("refuses a caller with no session", async () => {
    const response = await upload(form());

    expect(response.status).toBe(401);
    expect(state.inserted).toEqual([]);
  });

  it("refuses an upload that names no workspace", async () => {
    state.account = session;

    const response = await upload(form({ workspaceId: null }));

    expect(response.status).toBe(400);
    expect(state.inserted).toEqual([]);
  });

  it("refuses an upload with an invalid file type", async () => {
    state.account = session;
    state.workspaceAccess = personalBoard;
    storeMedia();

    const response = await upload(
      form({ file: new File([new Uint8Array([1])], "notes.pdf", { type: "application/pdf" }) }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("image");
    expect(state.inserted).toEqual([]);
    expect(state.requests).toEqual([]);
  });

  it("answers 404 for a workspace the caller cannot reach", async () => {
    state.account = session;

    expect((await upload(form())).status).toBe(404);
    expect(state.inserted).toEqual([]);
  });

  it("refuses an upload into an archived workspace", async () => {
    state.account = session;
    state.workspaceAccess = {
      ...teamBoard,
      workspace: { id: "ws_1", orgId: "org_acme", archivedAt: new Date() },
    };

    expect((await upload(form())).status).toBe(403);
    expect(state.inserted).toEqual([]);
    expect(state.requests).toEqual([]);
  });

  it("refuses an upload on a deployment that stores no media", async () => {
    state.account = session;
    state.workspaceAccess = personalBoard;

    const response = await upload(form());

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("does not store media");
    expect(state.inserted).toEqual([]);
    expect(state.requests).toEqual([]);
  });

  it("writes the object through the storage API and answers with its address", async () => {
    state.account = session;
    state.workspaceAccess = teamBoard;
    storeMedia();

    const response = await upload(form());

    const created = (await response.json()) as { id: string; url: string };

    expect(response.status).toBe(201);
    expect(created.url).toBe(`/api/media/${created.id}`);
    expect(created.id).toBe(state.inserted[0]?.id);
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0]?.method).toBe("POST");
    expect(state.requests[0]?.url.startsWith("http://storage.test/storage/v1/object/media/")).toBe(
      true,
    );
    expect(state.inserted[0]).toMatchObject({
      uploadedByUserId: "user_1",
      orgId: "org_acme",
      mimeType: "image/png",
      byteSize: 3,
    });
  });

  it("scopes a personal board's file to its uploader alone", async () => {
    state.account = session;
    state.workspaceAccess = personalBoard;
    storeMedia();

    expect((await upload(form())).status).toBe(201);
    expect(state.inserted[0]).toMatchObject({ orgId: null });
  });
});
