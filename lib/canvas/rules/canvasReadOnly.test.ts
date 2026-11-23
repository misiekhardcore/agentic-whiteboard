import { describe, expect, it } from "vitest";

import { canvasReadOnly } from "./canvasReadOnly";

describe("a canvas connection's read-only flag", () => {
  it("is read-only for an archived workspace even when the role may edit", () => {
    expect(canvasReadOnly({ permission: "edit", archived: true })).toBe(true);
  });

  it("is read-only for a person who may only view", () => {
    expect(canvasReadOnly({ permission: "view", archived: false })).toBe(true);
  });

  it("is writable for a person who may edit a live workspace", () => {
    expect(canvasReadOnly({ permission: "edit", archived: false })).toBe(false);
  });
});
