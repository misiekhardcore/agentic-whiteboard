import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { canvasRoomFiles } from "./canvasRoomFiles";
import { forgetCanvasRoomStorage } from "./forgetCanvasRoomStorage";

const workspaceId = "wsone9k2m4p7q1r3s5t8u0vx";

const directories: string[] = [];

function directory(): string {
  const created = mkdtempSync(join(tmpdir(), "canvas-rooms-"));
  directories.push(created);

  return created;
}

afterEach(() => {
  for (const created of directories.splice(0)) rmSync(created, { recursive: true, force: true });
});

describe("forgetting a canvas's working store", () => {
  it("removes the database and the sidecars SQLite keeps beside it", () => {
    const root = directory();
    const files = canvasRoomFiles({ directory: root, workspaceId });
    for (const file of files) writeFileSync(file, "");

    forgetCanvasRoomStorage({ directory: root, workspaceId });

    expect(files.map((file) => existsSync(file))).toEqual([false, false, false]);
  });

  it("says nothing when the canvas never had a file", () => {
    const root = directory();

    expect(() => forgetCanvasRoomStorage({ directory: root, workspaceId })).not.toThrow();
  });
});
