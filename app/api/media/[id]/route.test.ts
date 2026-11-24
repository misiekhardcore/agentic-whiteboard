import { afterEach, describe, expect, it, vi } from "vitest";

type ReadState = {
  account: unknown;
  row: unknown;
  config: unknown;
  object: unknown;
  deleted: { id: string; storageKey: string }[];
};

const state = vi.hoisted((): ReadState => ({
  account: null,
  row: null,
  config: null,
  object: null,
  deleted: [],
}));

vi.mock("@/lib/identity/account", () => ({
  getSessionAccount: () => Promise.resolve(state.account),
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
  deleteMedia: (input: { file: { id: string; storageKey: string } }) => {
    state.deleted.push(input.file);
    return Promise.resolve();
  },
  createMedia: vi.fn(),
}));

import { DELETE, GET } from "./route";

const signedIn = {
  session: { user: { id: "user_1" } },
  teams: [{ id: "org_acme" }],
  activeTeam: null,
  activeOrganizationId: "org_acme",
};

const config = {
  storageUrl: "http://localhost:8000",
  serviceRoleKey: "service-role",
  bucket: "media",
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

afterEach(() => {
  state.account = null;
  state.row = null;
  state.config = null;
  state.object = null;
  state.deleted = [];
});

describe("the media read route", () => {
  it("refuses a caller with no session", async () => {
    expect((await call().read()).status).toBe(401);
  });

  it("answers 404 for a media id nobody stored", async () => {
    state.account = signedIn;

    expect((await call("media_missing").read()).status).toBe(404);
  });

  it("streams a personal file to its uploader", async () => {
    state.account = signedIn;
    state.row = personalImage;
    state.config = config;
    state.object = { body: new Blob(["pixels"]).stream(), contentType: "image/png" };

    const response = await call().read();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("pixels");
  });

  it("answers 404 for a personal file someone else uploaded", async () => {
    state.account = signedIn;
    state.row = { ...personalImage, uploadedByUserId: "user_2" };
    state.config = config;

    expect((await call().read()).status).toBe(404);
  });

  it("streams an account file to a teammate on a board that references it", async () => {
    state.account = { ...signedIn, session: { user: { id: "user_2" } } };
    state.row = teamImage;
    state.config = config;
    state.object = { body: new Blob(["pixels"]).stream(), contentType: "image/png" };

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
    state.row = teamImage;
    state.config = config;

    expect((await call().read()).status).toBe(404);
  });

  it("answers 503 on a deployment that stores no media", async () => {
    state.account = signedIn;
    state.row = personalImage;

    expect((await call().read()).status).toBe(503);
  });

  it("answers 404 when the row names an object that is no longer there", async () => {
    state.account = signedIn;
    state.row = personalImage;
    state.config = config;

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
    state.row = { ...personalImage, uploadedByUserId: "user_2" };
    state.config = config;

    expect((await call().remove()).status).toBe(404);
    expect(state.deleted).toEqual([]);
  });

  it("removes the object and the row for the uploader", async () => {
    state.account = signedIn;
    state.row = personalImage;
    state.config = config;

    const response = await call().remove();

    expect(response.status).toBe(204);
    expect(state.deleted).toEqual([{ ...personalImage }]);
  });

  it("answers 503 on a deployment that stores no media", async () => {
    state.account = signedIn;
    state.row = personalImage;

    expect((await call().remove()).status).toBe(503);
    expect(state.deleted).toEqual([]);
  });
});
