import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ReadState = {
  account: unknown;
  rows: unknown[];
  deleted: unknown[];
  object: string | null;
  requests: { method: string; url: string }[];
};

const state = vi.hoisted((): ReadState => ({
  account: null,
  rows: [],
  deleted: [],
  object: null,
  requests: [],
}));

vi.mock("@/lib/identity/account", () => ({
  getSessionAccount: () => Promise.resolve(state.account),
}));

// The row reads and the row delete are mocked; the rules, the store and the
// adapter run for real, so the route's answering is what the test exercises.
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(state.rows) }),
      }),
    }),
    delete: () => ({
      where: (condition: unknown) => {
        state.deleted.push(condition);
        return Promise.resolve();
      },
    }),
  },
}));

import { DELETE, GET } from "./route";

const signedIn = {
  session: { user: { id: "user_1" } },
  teams: [{ id: "org_acme" }],
  activeTeam: null,
  activeOrganizationId: "org_acme",
};

const personalImage = {
  id: "media_1",
  uploadedByUserId: "user_1",
  orgId: null,
  mimeType: "image/png",
  byteSize: 6,
  storageKey: "media_1",
};

const teamImage = { ...personalImage, orgId: "org_acme" };

const fakeFetch = vi.fn((url: string | URL, init?: RequestInit) => {
  const method = init?.method ?? "GET";
  state.requests.push({ method, url: String(url) });

  if (method !== "GET") return Promise.resolve(new Response(null, { status: 200 }));

  return Promise.resolve(
    state.object === null
      ? new Response(null, { status: 404 })
      : new Response(state.object, { status: 200, headers: { "content-type": "image/png" } }),
  );
});

/** The two settings a deployment needs before it stores anything. */
function storeMedia() {
  vi.stubEnv("MEDIA_STORAGE_URL", "http://storage.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
}

function call(id = "media_1") {
  return {
    read: () =>
      GET(new Request(`http://localhost/api/media/${id}`), { params: Promise.resolve({ id }) }),
    remove: () =>
      DELETE(new Request(`http://localhost/api/media/${id}`, { method: "DELETE" }), {
        params: Promise.resolve({ id }),
      }),
  };
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
  state.rows = [];
  state.deleted = [];
  state.object = null;
  state.requests = [];
  vi.clearAllMocks();
});

describe("the media read route", () => {
  it("refuses a caller with no session", async () => {
    expect((await call().read()).status).toBe(401);
  });

  it("answers 404 for a media id nobody stored", async () => {
    state.account = signedIn;
    state.rows = [];

    expect((await call("media_missing").read()).status).toBe(404);
    expect(state.requests).toEqual([]);
  });

  it("streams a personal file to its uploader through the storage API", async () => {
    state.account = signedIn;
    state.rows = [personalImage];
    state.object = "pixels";
    storeMedia();

    const response = await call().read();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("pixels");
    expect(state.requests).toEqual([
      { method: "GET", url: "http://storage.test/storage/v1/object/media/media_1" },
    ]);
  });

  it("answers 404 for a personal file someone else uploaded", async () => {
    state.account = signedIn;
    state.rows = [{ ...personalImage, uploadedByUserId: "user_2" }];
    state.object = "pixels";
    storeMedia();

    expect((await call().read()).status).toBe(404);
    expect(state.requests).toEqual([]);
  });

  it("streams an account file to a teammate on a board that references it", async () => {
    state.account = { ...signedIn, session: { user: { id: "user_2" } } };
    state.rows = [teamImage];
    state.object = "pixels";
    storeMedia();

    const response = await call().read();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("pixels");
  });

  it("answers 404 for an account file to someone outside that account", async () => {
    state.account = {
      ...signedIn,
      teams: [{ id: "org_other" }],
      activeOrganizationId: "org_other",
    };
    // Not the uploader either, so only the account scope can let this read through.
    state.rows = [{ ...teamImage, uploadedByUserId: "user_2" }];
    state.object = "pixels";
    storeMedia();

    expect((await call().read()).status).toBe(404);
  });

  it("answers 503 on a deployment that stores no media", async () => {
    state.account = signedIn;
    state.rows = [personalImage];

    const response = await call().read();

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("does not store media");
  });

  it("answers 404 when the row names an object that is no longer there", async () => {
    state.account = signedIn;
    state.rows = [personalImage];
    storeMedia();

    expect((await call().read()).status).toBe(404);
  });
});

describe("the media delete route", () => {
  it("refuses a caller with no session", async () => {
    expect((await call().remove()).status).toBe(401);
    expect(state.deleted).toEqual([]);
  });

  it("answers 404 for a file someone else uploaded", async () => {
    state.account = signedIn;
    state.rows = [{ ...personalImage, uploadedByUserId: "user_2" }];
    storeMedia();

    expect((await call().remove()).status).toBe(404);
    expect(state.deleted).toEqual([]);
  });

  it("removes the object before the row for the uploader", async () => {
    state.account = signedIn;
    state.rows = [personalImage];
    storeMedia();

    const response = await call().remove();

    expect(response.status).toBe(204);
    expect(state.requests).toEqual([
      { method: "DELETE", url: "http://storage.test/storage/v1/object/media/media_1" },
    ]);
    expect(state.deleted).toHaveLength(1);
  });

  it("answers 503 on a deployment that stores no media", async () => {
    state.account = signedIn;
    state.rows = [personalImage];

    expect((await call().remove()).status).toBe(503);
    expect(state.deleted).toEqual([]);
  });
});
