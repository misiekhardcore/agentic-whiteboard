import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  scheduled: [] as (() => Promise<void> | void)[],
  named: [] as string[],
  failure: null as Error | null,
}));

vi.mock("next/server", () => ({
  after: (work: () => Promise<void> | void) => {
    mocks.scheduled.push(work);
  },
}));

vi.mock("./titleConversation", () => ({
  titleConversation: ({ conversationId }: { conversationId: string }) => {
    if (mocks.failure) return Promise.reject(mocks.failure);
    mocks.named.push(conversationId);
    return Promise.resolve(null);
  },
}));

import { scheduleConversationTitle } from "./scheduleConversationTitle";

beforeEach(() => {
  mocks.scheduled = [];
  mocks.named = [];
  mocks.failure = null;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("the background title request", () => {
  it("names the conversation only once the response is finished", async () => {
    scheduleConversationTitle({ conversationId: "conversation_wait", userId: "user_1" });

    expect(mocks.scheduled).toHaveLength(1);
    expect(mocks.named).toEqual([]);

    await mocks.scheduled[0]();

    expect(mocks.named).toEqual(["conversation_wait"]);
  });

  it("swallows a failed attempt instead of breaking the response", async () => {
    mocks.failure = new Error("database is down");

    scheduleConversationTitle({ conversationId: "conversation_fail", userId: "user_1" });

    await expect(mocks.scheduled[0]()).resolves.toBeUndefined();
  });
});
