import { describe, expect, it } from "vitest";

import { changeTopicFor } from "./changeTopicFor";

const personal = { person: "app:user:user_1", organization: null };
const organization = { person: "app:user:user_1", organization: "app:org:org_1" };

describe("changeTopicFor", () => {
  it("keeps a person-scoped change on the person's channel", () => {
    expect(changeTopicFor({ key: "settings", scope: "person" }, organization)).toBe(
      "app:user:user_1",
    );
  });

  it("sends an account change to the active organization", () => {
    expect(changeTopicFor({ key: "account", scope: "account" }, organization)).toBe(
      "app:org:org_1",
    );
  });

  it("sends an account change to the person when the account is personal", () => {
    expect(changeTopicFor({ key: "account", scope: "account" }, personal)).toBe("app:user:user_1");
  });
});
