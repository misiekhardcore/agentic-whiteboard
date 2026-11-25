import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CanvasRooms } from "../rooms/canvasRooms";

import { createCanvasService } from "./canvasService";

const serviceSecret = "canvas-service-secret-0123456789";

const servers: { close: (callback: () => void) => void }[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

async function listeningService() {
  const rooms = {
    open: () => Promise.reject(new Error("this test opens no sockets")),
    revoke: vi.fn(() => Promise.resolve()),
    forget: vi.fn(() => Promise.resolve()),
    shutdown: () => Promise.resolve(),
  } satisfies CanvasRooms;

  const server = createCanvasService({ serviceSecret, rooms, log: () => undefined });
  servers.push(server);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const { port } = server.address() as AddressInfo;

  return { rooms, origin: `http://127.0.0.1:${port}` };
}

function post(origin: string, path: string, secret?: string) {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

describe("the canvas service's doors", () => {
  it("answers its health read", async () => {
    const { origin } = await listeningService();

    const response = await fetch(`${origin}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("closes a canvas's sessions when the app revokes it", async () => {
    const { rooms, origin } = await listeningService();

    const response = await post(origin, "/revoke/wsone9k2m4p7q1r3s5t8u0vx", serviceSecret);

    expect(response.status).toBe(204);
    expect(rooms.revoke).toHaveBeenCalledWith("wsone9k2m4p7q1r3s5t8u0vx");
  });

  it("forgets a deleted workspace's canvas", async () => {
    const { rooms, origin } = await listeningService();

    const response = await post(origin, "/forget/wsone9k2m4p7q1r3s5t8u0vx", serviceSecret);

    expect(response.status).toBe(204);
    expect(rooms.forget).toHaveBeenCalledWith("wsone9k2m4p7q1r3s5t8u0vx");
  });

  it("refuses both room calls without the service credential", async () => {
    const { rooms, origin } = await listeningService();

    const forgotten = await post(origin, "/forget/wsone9k2m4p7q1r3s5t8u0vx");
    const revoked = await post(origin, "/revoke/wsone9k2m4p7q1r3s5t8u0vx", "another-secret");

    expect(forgotten.status).toBe(401);
    expect(revoked.status).toBe(401);
    expect(rooms.forget).not.toHaveBeenCalled();
    expect(rooms.revoke).not.toHaveBeenCalled();
  });

  it("serves nothing else", async () => {
    const { origin } = await listeningService();

    const response = await fetch(`${origin}/workspaces`);

    expect(response.status).toBe(404);
  });
});
