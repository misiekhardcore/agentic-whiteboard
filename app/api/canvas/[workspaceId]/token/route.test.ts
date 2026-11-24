import { afterEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted((): { current: unknown } => ({ current: null }));
const access = vi.hoisted((): { current: unknown } => ({ current: null }));

vi.mock("@/lib/identity/account", () => ({
  getSessionAccount: () => Promise.resolve(account.current),
}));

vi.mock("@/lib/workspace/access", async (importOriginal) => ({
  ...(await importOriginal<typeof workspaceAccessModule>()),
  getWorkspaceForUser: () => Promise.resolve(access.current),
}));

import { verifyCanvasToken } from "@/lib/canvas/tokens";
import type * as workspaceAccessModule from "@/lib/workspace/access";

import { GET } from "./route";

const workspaceId = "wsone9k2m4p7q1r3s5t8u0vx";
const secret = "canvas-service-secret";

const session = { session: { user: { id: "user_1" } }, activeOrganizationId: null };

function workspaceAccess({ archived }: { archived: boolean }) {
  return {
    workspace: {
      id: workspaceId,
      name: "Roadmap",
      description: null,
      creatorId: "user_1",
      orgId: null,
      status: "PLANNING",
      position: 0,
      shareToken: null,
      archivedAt: archived ? new Date("2026-11-20T00:00:00Z") : null,
      createdAt: new Date("2026-11-01T00:00:00Z"),
      updatedAt: new Date("2026-11-01T00:00:00Z"),
    },
    kind: "personal",
    organizationId: null,
    role: "owner",
  };
}

function configure({ serviceIsUp = true }: { serviceIsUp?: boolean } = {}) {
  vi.stubEnv("NEXT_PUBLIC_CANVAS_SERVICE_URL", "ws://localhost:4100");
  vi.stubEnv("CANVAS_SERVICE_SECRET", secret);
  vi.stubGlobal(
    "fetch",
    serviceIsUp
      ? vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
      : vi.fn().mockRejectedValue(new TypeError("fetch failed")),
  );
}

function call() {
  return GET(new Request(`http://localhost/api/canvas/${workspaceId}/token`), {
    params: Promise.resolve({ workspaceId }),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  account.current = null;
  access.current = null;
});

describe("the canvas token route", () => {
  it("refuses a caller with no session", async () => {
    configure();

    expect((await call()).status).toBe(401);
  });

  it("answers 404 for a workspace the caller cannot read", async () => {
    configure();
    account.current = session;
    access.current = null;

    expect((await call()).status).toBe(404);
  });

  it("answers 503 when the canvas service does not answer", async () => {
    configure({ serviceIsUp: false });
    account.current = session;
    access.current = workspaceAccess({ archived: false });

    const response = await call();

    expect(response.status).toBe(503);
  });

  it("answers 503 when the deployment runs no canvas service", async () => {
    vi.stubEnv("NEXT_PUBLIC_CANVAS_SERVICE_URL", "");
    vi.stubEnv("CANVAS_SERVICE_SECRET", "");
    account.current = session;
    access.current = workspaceAccess({ archived: false });

    const response = await call();

    expect(response.status).toBe(503);
  });

  it("hands out one connection address carrying a fresh, writable token", async () => {
    configure();
    account.current = session;
    access.current = workspaceAccess({ archived: false });

    const response = await call();
    const { uri } = (await response.json()) as { uri: string };
    const url = new URL(uri);
    const claims = verifyCanvasToken({
      token: url.searchParams.get("token") ?? "",
      secret,
    });

    expect(url.origin).toBe("ws://localhost:4100");
    expect(url.pathname).toBe(`/connect/${workspaceId}`);
    expect(url.searchParams.has("sessionId")).toBe(false);
    expect(claims).toMatchObject({
      userId: "user_1",
      workspaceId,
      permission: "edit",
      readOnly: false,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("marks an archived workspace's connection read-only", async () => {
    configure();
    account.current = session;
    access.current = workspaceAccess({ archived: true });

    const { uri } = (await (await call()).json()) as { uri: string };
    const claims = verifyCanvasToken({
      token: new URL(uri).searchParams.get("token") ?? "",
      secret,
    });

    expect(claims).toMatchObject({ readOnly: true });
  });
});
