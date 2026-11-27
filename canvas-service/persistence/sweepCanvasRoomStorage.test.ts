import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { canvasRoomFiles } from "./canvasRoomFiles";
import { sweepCanvasRoomStorage } from "./sweepCanvasRoomStorage";

const liveId = "wslive9k2m4p7q1r3s5t8u0vx";
const deadId = "wsdead9k2m4p7q1r3s5t8u0vx";
const unknownId = "wsunknown9k2m4p7q1r3s5";

const directories: string[] = [];

function directory(): string {
  const created = mkdtempSync(join(tmpdir(), "canvas-rooms-"));
  directories.push(created);

  return created;
}

afterEach(() => {
  for (const created of directories.splice(0)) rmSync(created, { recursive: true, force: true });
});

function storeFile(directory: string, workspaceId: string): string {
  const [database] = canvasRoomFiles({ directory, workspaceId });
  writeFileSync(database, "");

  return database;
}

describe("sweeping the canvas service's rooms directory", () => {
  it("drops the store of a canvas the app no longer has and keeps the live one", async () => {
    const root = directory();
    const live = storeFile(root, liveId);
    const dead = storeFile(root, deadId);

    const removed = await sweepCanvasRoomStorage({
      directory: root,
      isLive: (workspaceId) => Promise.resolve(workspaceId !== deadId),
    });

    expect(removed).toBe(1);
    expect(existsSync(live)).toBe(true);
    expect(existsSync(dead)).toBe(false);
  });

  it("keeps a store when the app cannot say whether its canvas exists", async () => {
    const root = directory();
    const unknown = storeFile(root, unknownId);

    const removed = await sweepCanvasRoomStorage({
      directory: root,
      isLive: () => Promise.reject(new Error("the app is unreachable")),
    });

    expect(removed).toBe(0);
    expect(existsSync(unknown)).toBe(true);
  });

  it("does nothing when the service has never opened a canvas", async () => {
    const root = directory();

    await expect(
      sweepCanvasRoomStorage({ directory: root, isLive: () => Promise.resolve(true) }),
    ).resolves.toBe(0);
  });
});
