import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    kept: [] as (() => Promise<void> | void)[],
    started: [] as string[],
    settled: [] as string[],
    resolve: null as (() => void) | null,
    failure: null as Error | null,
  };
  return state;
});

vi.mock("next/server", () => ({
  after: (work: () => Promise<void> | void) => {
    mocks.kept.push(work);
  },
}));

vi.mock("./titleConversation", () => ({
  titleConversation: ({ conversationId }: { conversationId: string }) => {
    mocks.started.push(conversationId);
    if (mocks.failure) return Promise.reject(mocks.failure);

    return new Promise<null>((resolve) => {
      mocks.resolve = () => {
        mocks.settled.push(conversationId);
        resolve(null);
      };
    });
  },
}));

import { startConversationTitle } from "./startConversationTitle";

beforeEach(() => {
  mocks.kept = [];
  mocks.started = [];
  mocks.settled = [];
  mocks.resolve = null;
  mocks.failure = null;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("the conversation title request", () => {
  it("starts naming as soon as the prompt is stored, before the response is kept alive", () => {
    startConversationTitle({ conversationId: "conversation_parallel", userId: "user_1" });

    // The request is already in flight; `after` only holds the response open.
    expect(mocks.started).toEqual(["conversation_parallel"]);
    expect(mocks.kept).toHaveLength(1);
    expect(mocks.kept[0]).not.toBeUndefined();
  });

  it("does not make the turn wait for the title", async () => {
    startConversationTitle({ conversationId: "conversation_wait", userId: "user_1" });

    // Nothing has resolved, yet the caller already has control back.
    expect(mocks.settled).toEqual([]);

    mocks.resolve?.();
    await mocks.kept[0]();

    expect(mocks.settled).toEqual(["conversation_wait"]);
  });

  it("swallows a failed attempt instead of breaking the kept-alive response", async () => {
    mocks.failure = new Error("database is down");

    startConversationTitle({ conversationId: "conversation_fail", userId: "user_1" });

    await expect(mocks.kept[0]()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
