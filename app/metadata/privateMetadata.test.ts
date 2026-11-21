import { describe, expect, it } from "vitest";

import { privateMetadata } from "./privateMetadata";

describe("privateMetadata", () => {
  it("keeps signed-in pages out of search results", () => {
    expect(privateMetadata.robots).toEqual({ index: false, follow: false });
  });

  it("does not inherit the homepage canonical onto private pages", () => {
    expect(privateMetadata.alternates?.canonical).toBeNull();
  });
});
