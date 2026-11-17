import { describe, expect, it } from "vitest";

import { stored } from "./fixtures.test-helpers";
import { threadMessages } from "./threadMessages";

describe("threadMessages", () => {
  it("replays persisted messages with AI SDK roles and parts", () => {
    expect(
      threadMessages([
        stored({ id: "msg_1", role: "USER" }),
        stored({
          id: "msg_2",
          role: "ASSISTANT",
          parts: [{ type: "text", text: "Here is the plan" }],
        }),
      ]),
    ).toEqual([
      {
        id: "msg_1",
        role: "user",
        parts: [{ type: "text", text: "Plan the schema" }],
      },
      {
        id: "msg_2",
        role: "assistant",
        parts: [{ type: "text", text: "Here is the plan" }],
      },
    ]);
  });

  it("keeps the stored order", () => {
    expect(
      threadMessages([
        stored({ id: "msg_1" }),
        stored({ id: "msg_2", role: "ASSISTANT" }),
        stored({ id: "msg_3" }),
      ]).map((message) => message.id),
    ).toEqual(["msg_1", "msg_2", "msg_3"]);
  });
});
