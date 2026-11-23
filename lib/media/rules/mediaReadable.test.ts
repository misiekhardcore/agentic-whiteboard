import { describe, expect, it } from "vitest";

import { mediaReadable } from "./mediaReadable";

const owner = { uploadedByUserId: "user_owner", workspaceId: "ws_roadmap" };
const unattached = { uploadedByUserId: "user_owner", workspaceId: null };

describe("who may read a media object", () => {
  it("lets anyone who can read the workspace read its media", () => {
    expect(
      mediaReadable({
        media: owner,
        viewer: { userId: "user_member", canReadWorkspace: true },
      }),
    ).toBe(true);
  });

  it("refuses a workspace's media to someone outside it", () => {
    expect(
      mediaReadable({
        media: owner,
        viewer: { userId: "user_member", canReadWorkspace: false },
      }),
    ).toBe(false);
  });

  it("refuses the uploader once they can no longer read the workspace", () => {
    expect(
      mediaReadable({
        media: owner,
        viewer: { userId: "user_owner", canReadWorkspace: false },
      }),
    ).toBe(false);
  });

  it("keeps an unattached file to whoever uploaded it", () => {
    expect(
      mediaReadable({
        media: unattached,
        viewer: { userId: "user_owner", canReadWorkspace: false },
      }),
    ).toBe(true);
    expect(
      mediaReadable({
        media: unattached,
        viewer: { userId: "user_other", canReadWorkspace: true },
      }),
    ).toBe(false);
  });
});
