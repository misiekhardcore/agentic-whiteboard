import { describe, expect, it } from "vitest";

import { turnChanges } from "./turnChanges";

describe("turnChanges", () => {
  it("names the switcher and the usage meter for a new prompt", () => {
    expect(turnChanges(false)).toEqual([
      { key: "conversations", scope: "person" },
      { key: "account", scope: "person" },
    ]);
  });

  it("names nothing for a turn that continues one already counted", () => {
    expect(turnChanges(true)).toEqual([]);
  });
});
