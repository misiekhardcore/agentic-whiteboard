import { describe, expect, it } from "vitest";

import { changeChannels } from "./changeChannels";

describe("changeChannels", () => {
  it("gives a personal account its own channel and no organization one", () => {
    expect(changeChannels({ userId: "user_1", organizationId: null })).toEqual({
      person: "app:user:user_1",
      organization: null,
    });
  });

  it("adds the active organization's channel", () => {
    expect(changeChannels({ userId: "user_1", organizationId: "org_1" })).toEqual({
      person: "app:user:user_1",
      organization: "app:org:org_1",
    });
  });

  it("refuses an id that could forge another channel", () => {
    expect(() => changeChannels({ userId: "user:1", organizationId: null })).toThrow(
      /cannot name a change topic/,
    );
  });
});
