import { describe, expect, it } from "vitest";

import { conversationIdProblem } from "./conversationIdProblem";

describe("conversationIdProblem", () => {
  it("accepts the ids the composer and the migration produce", () => {
    expect(conversationIdProblem("0b8f0df2-5b4a-4b4d-8a4e-2f0f0e6c9a11")).toBeNull();
    expect(conversationIdProblem("legacy-user_2f0f0e6c9a11")).toBeNull();
  });

  it("refuses an id that is empty, padded or the wrong shape", () => {
    for (const id of ["", "  ", " id with spaces ", "-leading", "a", "x".repeat(65)]) {
      expect(conversationIdProblem(id)).toBe("Send the conversation this prompt belongs to.");
    }
  });
});
