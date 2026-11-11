import { describe, expect, it } from "vitest";

import {
  AGENT_MESSAGE_EVENT,
  AGENT_STATUS_EVENT,
  CollabTopicError,
  organizationBoardTopic,
  parseWorkspaceDocumentName,
  WORKSPACE_UPDATED_EVENT,
  workspaceCanvasName,
  workspaceDocName,
  workspaceTopic,
} from "./topics";

describe("workspace topics", () => {
  it("builds distinct channel and Hocuspocus document names", () => {
    expect(workspaceTopic("ws_abc123")).toBe("workspace:ws_abc123");
    expect(workspaceDocName("ws_abc123")).toBe("workspace:ws_abc123:doc");
    expect(workspaceCanvasName("ws_abc123")).toBe("workspace:ws_abc123:canvas");
    expect(organizationBoardTopic("org_abc123")).toBe(
      "org:org_abc123:board",
    );
  });

  it("uses stable event names", () => {
    expect(AGENT_STATUS_EVENT).toBe("agent.status");
    expect(AGENT_MESSAGE_EVENT).toBe("agent.message");
    expect(WORKSPACE_UPDATED_EVENT).toBe("workspace.updated");
  });

  it("round-trips both surfaces through the document parser", () => {
    expect(parseWorkspaceDocumentName(workspaceDocName("ws_1"))).toEqual({
      workspaceId: "ws_1",
      surface: "doc",
    });
    expect(parseWorkspaceDocumentName(workspaceCanvasName("ws_1"))).toEqual({
      workspaceId: "ws_1",
      surface: "canvas",
    });
  });

  it("rejects document names this app did not create", () => {
    expect(parseWorkspaceDocumentName("workspace:ws_1")).toBeNull();
    expect(parseWorkspaceDocumentName("workspace:ws_1:other")).toBeNull();
    expect(parseWorkspaceDocumentName("org:o_1:board")).toBeNull();
    expect(parseWorkspaceDocumentName("workspace::doc")).toBeNull();
  });
});

describe("id validation", () => {
  it("rejects ids that could forge a topic", () => {
    for (const id of ["", "ws:1", "ws 1", "ws/1", "a".repeat(65)]) {
      expect(() => workspaceTopic(id)).toThrow(CollabTopicError);
    }
    expect(() => organizationBoardTopic("org:1")).toThrow(CollabTopicError);
  });
});
