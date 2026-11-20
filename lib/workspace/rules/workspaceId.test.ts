import { describe, expect, it } from "vitest";

import { WORKSPACE_ID_INVALID_MESSAGE } from "./constants";
import { workspaceIdSchema } from "./workspaceId";

describe("workspaceIdSchema", () => {
  it("accepts the ids the database stores", () => {
    // cuid2, what the app mints today; and a UUID, what older rows still carry.
    expect(workspaceIdSchema.safeParse("we7i6vurawtizazdtcy1tvqm").success).toBe(true);
    expect(workspaceIdSchema.safeParse("7de3f818-81e2-4aba-b7a4-6bf7105e72fd").success).toBe(true);
  });

  it("rejects a word where an id belongs", () => {
    const result = workspaceIdSchema.safeParse("everything");

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(WORKSPACE_ID_INVALID_MESSAGE);
  });

  it("rejects the model's own scribbles instead of asking the database", () => {
    const scribbles = [
      "> (sxl00v0meloleenvaz1fjdwc) for the pre-existing ones. No new workspaces were created",
      "> </workspaceId> still can't shake that stray text. Let me type the id: walx0s5gs8xavk8kbxswi3x3",
      "ws one",
    ];

    for (const scribble of scribbles) {
      expect(workspaceIdSchema.safeParse(scribble).success).toBe(false);
    }
  });

  it("asks for a workspace when nothing was chosen", () => {
    expect(workspaceIdSchema.safeParse("").error?.issues[0]?.message).toBe("Choose a workspace.");
  });

  it("refuses an id longer than the contract allows", () => {
    expect(workspaceIdSchema.safeParse("a".repeat(65)).success).toBe(false);
  });
});
