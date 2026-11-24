import { describe, expect, it } from "vitest";

import { mediaDeletable } from "./mediaDeletable";

const file = { uploadedByUserId: "user_owner" };

describe("who may delete a stored file", () => {
  it("lets its uploader delete it", () => {
    expect(mediaDeletable({ media: file, requesterId: "user_owner" })).toBe(true);
  });

  it("refuses a teammate of the same account", () => {
    expect(mediaDeletable({ media: file, requesterId: "user_teammate" })).toBe(false);
  });
});
