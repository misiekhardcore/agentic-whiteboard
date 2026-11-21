import { describe, expect, it } from "vitest";

import { conversationOwner } from "./conversationOwner";

describe("conversationOwner", () => {
  it("files a personal conversation under the person's own id", () => {
    expect(conversationOwner({ userId: "user_1", organizationId: null })).toEqual({
      userId: "user_1",
      accountType: "PERSONAL",
      accountId: "user_1",
    });
  });

  it("files a conversation in the active organization, not under the person", () => {
    expect(conversationOwner({ userId: "user_1", organizationId: "org_1" })).toEqual({
      userId: "user_1",
      accountType: "ORGANIZATION",
      accountId: "org_1",
    });
  });
});
