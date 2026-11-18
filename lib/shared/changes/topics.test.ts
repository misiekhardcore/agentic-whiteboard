import { describe, expect, it } from "vitest";

import { ChangesTopicError } from "./ChangesTopicError";
import { organizationChangesTopic, personChangesTopic, workspaceChangeKey } from "./topics";

describe("change topics", () => {
  it("names one channel per person and one per organization", () => {
    expect(personChangesTopic("user_1")).toBe("app:user:user_1");
    expect(organizationChangesTopic("org_1")).toBe("app:org:org_1");
  });

  it("builds a per-workspace key", () => {
    expect(workspaceChangeKey("ws_1")).toBe("workspace:ws_1");
  });

  it("refuses an id that could name another channel", () => {
    for (const forged of ["user_1:admin", "a b", "", "x".repeat(65)]) {
      expect(() => personChangesTopic(forged)).toThrow(ChangesTopicError);
    }
    expect(() => organizationChangesTopic("org:1")).toThrow(ChangesTopicError);
    expect(() => workspaceChangeKey("ws/1")).toThrow(ChangesTopicError);
  });
});
