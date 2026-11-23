import { describe, expect, it } from "vitest";

import { mediaReadable } from "./mediaReadable";

const owner = { uploadedByUserId: "user_owner" };
const unattached = { uploadedByUserId: "user_owner" };

describe("who may read a media object", () => {
  it("only the uploader may read their own file", () => {
    // Since workspaceId is removed, the rule always checks uploader identity
    expect(
      mediaReadable({
        media: owner,
        viewer: { userId: "user_member", canReadWorkspace: true },
      }),
    ).toBe(false);
  });

  it("refuses a non-owner trying to read", () => {
    expect(
      mediaReadable({
        media: owner,
        viewer: { userId: "user_member", canReadWorkspace: false },
      }),
    ).toBe(false);
  });

  it("refuses the uploader once they can no longer read the workspace", () => {
    // Since workspaceId is removed, the rule always checks uploader identity
    // The uploader can always read their own file regardless of workspace access
    expect(
      mediaReadable({
        media: owner,
        viewer: { userId: "user_owner", canReadWorkspace: false },
      }),
    ).toBe(true);
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
