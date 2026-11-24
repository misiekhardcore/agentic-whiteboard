import { afterEach, describe, expect, it, vi } from "vitest";

const surfaces = vi.hoisted((): { stored: unknown; saved: unknown; writes: unknown[] } => ({
  stored: null,
  saved: null,
  writes: [],
}));

vi.mock("@/lib/workspace/surfaces", () => ({
  readCanvasSnapshot: () => Promise.resolve(surfaces.stored),
  saveCanvasSnapshot: (input: unknown) => {
    surfaces.writes.push(input);
    return Promise.resolve(surfaces.saved);
  },
}));

import { GET, PUT } from "./route";

const workspaceId = "wsone9k2m4p7q1r3s5t8u0vx";
const secret = "canvas-service-secret";

const snapshot = {
  clock: 7,
  documents: [{ lastChangedClock: 7, state: { id: "shape:one", typeName: "shape" } }],
};

function configure() {
  vi.stubEnv("NEXT_PUBLIC_CANVAS_SERVICE_URL", "ws://localhost:4100");
  vi.stubEnv("CANVAS_SERVICE_SECRET", secret);
}

function request({
  method = "GET",
  authorization = `Bearer ${secret}`,
  body,
}: {
  method?: "GET" | "PUT";
  authorization?: string | null;
  body?: unknown;
} = {}) {
  return new Request(`http://localhost/api/canvas/${workspaceId}/snapshot`, {
    method,
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function context() {
  return { params: Promise.resolve({ workspaceId }) };
}

afterEach(() => {
  vi.unstubAllEnvs();
  surfaces.stored = null;
  surfaces.saved = null;
  surfaces.writes = [];
});

describe("the canvas snapshot route", () => {
  it("refuses a caller without the service credential", async () => {
    configure();
    surfaces.stored = { revision: 1, snapshot };

    const response = await GET(request({ authorization: null }), context());

    expect(response.status).toBe(401);
  });

  it("hands the service the revision and snapshot a room starts from", async () => {
    configure();
    surfaces.stored = { revision: 3, snapshot };

    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ revision: 3, snapshot });
  });

  it("answers 404 when the workspace has no canvas row", async () => {
    configure();

    expect((await GET(request(), context())).status).toBe(404);
  });

  it("writes the snapshot at the revision the service names", async () => {
    configure();
    surfaces.saved = { ok: true, revision: 4 };

    const response = await PUT(
      request({ method: "PUT", body: { revision: 3, snapshot } }),
      context(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ revision: 4 });
    expect(surfaces.writes).toEqual([{ workspaceId, expectedRevision: 3, snapshot }]);
  });

  it("refuses a stale snapshot write and reports the stored revision", async () => {
    configure();
    surfaces.saved = { ok: false, currentRevision: 6 };

    const response = await PUT(
      request({ method: "PUT", body: { revision: 3, snapshot } }),
      context(),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ currentRevision: 6 });
  });

  it("refuses a body that is not a snapshot", async () => {
    configure();

    const response = await PUT(
      request({ method: "PUT", body: { revision: 0, snapshot: { documents: "all" } } }),
      context(),
    );

    expect(response.status).toBe(400);
  });
});
