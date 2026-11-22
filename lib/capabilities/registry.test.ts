import { describe, expect, it } from "vitest";

import { agentCapabilities, capabilities } from "./registry";

describe("capability registry", () => {
  it("names every capability once, because the name is also the stored key", () => {
    const names = capabilities.map((capability) => capability.name);

    expect(new Set(names).size).toBe(names.length);
    expect(names.sort()).toEqual([
      "acceptInvitation",
      "archiveWorkspace",
      "branchConversation",
      "cancelInvitation",
      "createOrganization",
      "createWorkspace",
      "deleteWorkspace",
      "getWorkspace",
      "inviteMember",
      "listWorkspaces",
      "moveWorkspace",
      "openWorkspace",
      "removeMember",
      "restoreWorkspace",
      "setReadAloud",
      "setReadAloudVoice",
      "switchAccount",
      "updateMemberRole",
      "updateOrganizationProfile",
      "updatePersonalProfile",
      "updateWorkspace",
    ]);
  });

  it("describes every capability for the model", () => {
    for (const capability of capabilities) {
      expect(capability.description.length).toBeGreaterThan(20);
      expect(capability.inputSchema).toBeTruthy();
    }
  });

  it("only waits for approval on something the agent can actually call", () => {
    for (const capability of capabilities) {
      if (capability.approval) {
        // eslint-disable-next-line vitest/no-conditional-expect
        expect(capability.callers).toContain("agent");
      }
    }
  });

  it("gives the agent exactly the workspace operations and the one client tool", () => {
    expect(agentCapabilities.map((capability) => capability.name).sort()).toEqual([
      "archiveWorkspace",
      "createWorkspace",
      "deleteWorkspace",
      "getWorkspace",
      "listWorkspaces",
      "moveWorkspace",
      "openWorkspace",
      "restoreWorkspace",
      "updateWorkspace",
    ]);
  });

  it("leaves a client tool with no server-side invocation", () => {
    const client = capabilities.find((capability) => capability.client === "openWorkspace");

    expect(client).toBeDefined();
    expect(client?.invoke).toBeUndefined();
  });

  it("requires a decision before the two removing operations run", () => {
    const gated = capabilities
      .filter((capability) => capability.approval)
      .map((capability) => capability.name)
      .sort();

    expect(gated).toEqual(["archiveWorkspace", "deleteWorkspace"]);
  });
});
