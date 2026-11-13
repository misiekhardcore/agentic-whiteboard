import { describe, expect, it } from "vitest";

import { formString } from "./form-data";

describe("formString", () => {
  it("returns the submitted text value", () => {
    const formData = new FormData();
    formData.set("email", "person@example.com");

    expect(formString(formData, "email")).toBe("person@example.com");
  });

  it("returns an empty string for a missing field", () => {
    expect(formString(new FormData(), "email")).toBe("");
  });

  it("returns an empty string for a file field instead of stringifying it", () => {
    const formData = new FormData();
    formData.set("attachment", new File(["contents"], "notes.txt"));

    expect(formString(formData, "attachment")).toBe("");
  });
});
