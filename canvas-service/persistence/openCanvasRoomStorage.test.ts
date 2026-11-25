import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { CanvasSnapshot } from "@/lib/canvas/contracts";

import { canvasRoomFiles } from "./canvasRoomFiles";
import { openCanvasRoomStorage } from "./openCanvasRoomStorage";
import type { CanvasRoomStorage } from "./types";

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

function snapshotAt(clock: number, recordId: string): CanvasSnapshot {
  return {
    clock,
    documentClock: clock,
    documents: [{ lastChangedClock: clock, state: { id: recordId, typeName: "shape" } }],
  };
}

function recordIds(store: CanvasRoomStorage): string[] {
  const snapshot = store.storage.getSnapshot?.();

  return (snapshot?.documents ?? []).map((document) => String(document.state.id));
}

describe("a canvas's working store", () => {
  it("starts a canvas from the row when it has no file yet", () => {
    const root = directory();
    const store = openCanvasRoomStorage({
      directory: root,
      workspaceId,
      stored: { revision: 2, snapshot: snapshotAt(5, "shape:row") },
    });

    expect(recordIds(store)).toEqual(["shape:row"]);
    expect(existsSync(canvasRoomFiles({ directory: root, workspaceId })[0])).toBe(true);
    store.close();
  });

  it("starts from the engine's empty canvas when the row has no snapshot", () => {
    const store = openCanvasRoomStorage({
      directory: directory(),
      workspaceId,
      stored: { revision: 0, snapshot: null },
    });

    // A new board is the engine's default page, not an empty record set.
    expect(recordIds(store)).toContain("page:page");
    store.close();
  });

  it("keeps the file's document even when the row is behind it", () => {
    const root = directory();
    const first = openCanvasRoomStorage({
      directory: root,
      workspaceId,
      stored: { revision: 1, snapshot: snapshotAt(5, "shape:file") },
    });
    first.close();

    const reopened = openCanvasRoomStorage({
      directory: root,
      workspaceId,
      stored: { revision: 1, snapshot: snapshotAt(3, "shape:row") },
    });

    expect(recordIds(reopened)).toEqual(["shape:file"]);
    reopened.close();
  });

  it("rebuilds the file when the row moved on while the file was away", () => {
    const root = directory();
    const first = openCanvasRoomStorage({
      directory: root,
      workspaceId,
      stored: { revision: 1, snapshot: snapshotAt(5, "shape:file") },
    });
    first.close();

    const reopened = openCanvasRoomStorage({
      directory: root,
      workspaceId,
      stored: { revision: 4, snapshot: snapshotAt(9, "shape:row") },
    });

    expect(recordIds(reopened)).toEqual(["shape:row"]);
    reopened.close();
  });

  it("closes the database without removing the file", () => {
    const root = directory();
    const store = openCanvasRoomStorage({
      directory: root,
      workspaceId,
      stored: { revision: 1, snapshot: snapshotAt(5, "shape:row") },
    });
    store.close();

    expect(existsSync(canvasRoomFiles({ directory: root, workspaceId })[0])).toBe(true);
  });
});
