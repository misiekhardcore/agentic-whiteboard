import { describe, expect, it } from "vitest";

import { newestActivityByWorkspace } from "./newestActivityByWorkspace";

const at = (value: string) => new Date(value);

describe("newest activity by workspace", () => {
  it("takes the newest activity across every surface of one workspace", () => {
    const newest = newestActivityByWorkspace([
      { workspaceId: "ws_roadmap", surface: "WORKSPACE", createdAt: at("2026-11-20T09:00:00Z") },
      { workspaceId: "ws_roadmap", surface: "CANVAS", createdAt: at("2026-11-21T10:00:00Z") },
      { workspaceId: "ws_roadmap", surface: "DOC", createdAt: at("2026-11-22T08:30:00Z") },
    ]);

    // The document was saved after the row was written, so the doc instant wins.
    expect(newest.get("ws_roadmap")).toEqual(at("2026-11-22T08:30:00Z"));
  });

  it("keeps each workspace's own newest activity apart", () => {
    const newest = newestActivityByWorkspace([
      { workspaceId: "ws_roadmap", surface: "DOC", createdAt: at("2026-11-22T08:30:00Z") },
      { workspaceId: "ws_launch", surface: "WORKSPACE", createdAt: at("2026-11-19T07:00:00Z") },
    ]);

    expect(newest.get("ws_roadmap")).toEqual(at("2026-11-22T08:30:00Z"));
    expect(newest.get("ws_launch")).toEqual(at("2026-11-19T07:00:00Z"));
    expect(newest.get("ws_missing")).toBeUndefined();
  });
});
