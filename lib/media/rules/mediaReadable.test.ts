import { describe, expect, it } from "vitest";

import { mediaReadable } from "./mediaReadable";

const personal = { uploadedByUserId: "user_owner", orgId: null };
const shared = { uploadedByUserId: "user_owner", orgId: "org_acme" };

const acmeMember = { userId: "user_member", organizationIds: ["org_acme"] };
const outsider = { userId: "user_other", organizationIds: ["org_other"] };

describe("who may read a stored file", () => {
  it("always lets the uploader read their own file", () => {
    expect(
      mediaReadable({ media: personal, viewer: { userId: "user_owner", organizationIds: [] } }),
    ).toBe(true);
  });

  it("keeps a personal file to its uploader", () => {
    expect(mediaReadable({ media: personal, viewer: acmeMember })).toBe(false);
  });

  it("lets a member of the file's account read it", () => {
    expect(mediaReadable({ media: shared, viewer: acmeMember })).toBe(true);
  });

  it("refuses someone outside the file's account", () => {
    expect(mediaReadable({ media: shared, viewer: outsider })).toBe(false);
  });

  it("keeps the uploader's own access after they leave the account", () => {
    expect(
      mediaReadable({ media: shared, viewer: { userId: "user_owner", organizationIds: [] } }),
    ).toBe(true);
  });
});
