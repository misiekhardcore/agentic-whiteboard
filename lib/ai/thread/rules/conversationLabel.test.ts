import { describe, expect, it } from "vitest";

import { conversationLabel } from "./conversationLabel";

describe("conversationLabel", () => {
  it("shows the generated title when there is one", () => {
    expect(conversationLabel({ title: "Sprint planning", preview: "Plan the sprint" })).toBe(
      "Sprint planning",
    );
  });

  it("falls back to the derived preview until a title exists", () => {
    expect(conversationLabel({ title: null, preview: "Plan the sprint" })).toBe("Plan the sprint");
  });
});
