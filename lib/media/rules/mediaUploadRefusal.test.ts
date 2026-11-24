import { describe, expect, it } from "vitest";

import { mediaUploadRefusal } from "./mediaUploadRefusal";

describe("whether a file may be stored as media", () => {
  it("accepts an image within the size limit", () => {
    expect(mediaUploadRefusal({ contentType: "image/png", byteSize: 4_096 })).toBeNull();
  });

  it("refuses a type that is not an image", () => {
    expect(mediaUploadRefusal({ contentType: "application/pdf", byteSize: 10 })).toContain("image");
  });

  it("refuses a file whose type the browser did not report", () => {
    expect(mediaUploadRefusal({ contentType: "", byteSize: 10 })).not.toBeNull();
  });

  it("refuses an empty file", () => {
    expect(mediaUploadRefusal({ contentType: "image/png", byteSize: 0 })).toContain("empty");
  });

  it("refuses a file over the size limit and names the limit in megabytes", () => {
    expect(mediaUploadRefusal({ contentType: "image/png", byteSize: 11 * 1024 * 1024 })).toContain(
      "10 MB",
    );
  });
});
