import type { LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The title service's database work is driven through a small fake, and its
 * model is a scripted `LanguageModel`. That keeps the assertions on the
 * behaviour a person can see: which prompt names the conversation, what is
 * stored once, and what is left alone when the model cannot answer.
 */
const mocks = vi.hoisted(() => ({
  conversation: null as { title: string | null } | null,
  firstMessage: null as { content: unknown } | null,
  updateRows: [] as { title: string }[],
  updateError: null as Error | null,
  written: [] as { title: string }[],
}));

vi.mock("@/lib/db", async () => {
  const { getTableName } = await import("drizzle-orm");

  const conversationRows = () => (mocks.conversation ? [mocks.conversation] : []);
  const messageRows = () => (mocks.firstMessage ? [mocks.firstMessage] : []);

  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          const name = getTableName(table as never);
          const afterWhere = () => {
            if (name === "agentConversation") {
              return { limit: () => Promise.resolve(conversationRows()) };
            }

            return { orderBy: () => ({ limit: () => Promise.resolve(messageRows()) }) };
          };

          return { where: afterWhere, innerJoin: () => ({ where: afterWhere }) };
        },
      }),
      update: (_table: unknown) => ({
        set: (values: { title: string }) => ({
          where: () => ({
            returning: () => {
              mocks.written.push(values);
              if (mocks.updateError) return Promise.reject(mocks.updateError);
              return Promise.resolve(mocks.updateRows);
            },
          }),
        }),
      }),
    },
  };
});

import { TITLE_OUTPUT_TOKENS } from "./constants";
import { generateConversationTitle, titleConversation } from "./titleConversation";

const USAGE = {
  inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 4, text: 4, reasoning: 0 },
};

function modelReturning(
  text: string,
  onCall?: (options: {
    prompt: unknown;
    maxOutputTokens?: number;
    providerOptions?: unknown;
  }) => void,
): LanguageModel {
  return new MockLanguageModelV4({
    doGenerate: (options) => {
      onCall?.(options);
      return Promise.resolve({
        content: [{ type: "text" as const, text }],
        finishReason: { unified: "stop" as const, raw: "stop" },
        usage: USAGE,
        warnings: [],
      });
    },
  });
}

function failingModel(): LanguageModel {
  return new MockLanguageModelV4({
    doGenerate: () => Promise.reject(new Error("provider is down")),
  });
}

const firstPrompt = { content: { parts: [{ type: "text", text: "Plan the schema" }] } };

beforeEach(() => {
  mocks.conversation = { title: null };
  mocks.firstMessage = firstPrompt;
  mocks.updateRows = [{ title: "Schema planning" }];
  mocks.updateError = null;
  mocks.written = [];
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("generateConversationTitle", () => {
  it("normalises the model's reply into a name", async () => {
    const title = await generateConversationTitle({
      prompt: "Plan the database schema",
      model: modelReturning('Title: "Schema planning."'),
      maxRetries: 0,
    });

    expect(title).toBe("Schema planning");
  });

  it("has no title when the model answered with nothing", async () => {
    const title = await generateConversationTitle({
      prompt: "Plan the database schema",
      model: modelReturning("   "),
      maxRetries: 0,
    });

    expect(title).toBeNull();
  });

  it("has no title when the model answered instead of naming the conversation", async () => {
    const title = await generateConversationTitle({
      prompt: "Plan the database schema",
      model: modelReturning("I cannot answer that question as asked."),
      maxRetries: 0,
    });

    expect(title).toBeNull();
  });

  it("leaves a reasoning model room to answer inside the output budget", async () => {
    let maxOutputTokens: number | undefined;

    await generateConversationTitle({
      prompt: "Plan the database schema",
      model: modelReturning("Title: Schema planning", (options) => {
        maxOutputTokens = options.maxOutputTokens;
      }),
      maxRetries: 0,
    });

    // A model that reasons before answering spends part of this budget on that
    // reasoning; a title-sized cap makes it return no text at all.
    expect(maxOutputTokens).toBe(TITLE_OUTPUT_TOKENS);
    expect(maxOutputTokens).toBeGreaterThanOrEqual(256);
  });

  it("sends the caller's provider options, so naming can turn reasoning off", async () => {
    let sent: unknown;

    await generateConversationTitle({
      prompt: "Plan the database schema",
      model: modelReturning("Title: Schema planning", (options) => {
        sent = options.providerOptions;
      }),
      maxRetries: 0,
      providerOptions: { ai: { reasoningEffort: "none" } },
    });

    expect(sent).toEqual({ ai: { reasoningEffort: "none" } });
  });

  it("names the conversation from the prompt, bounded to what the model needs", async () => {
    let sent: unknown;

    await generateConversationTitle({
      prompt: "x".repeat(5000),
      model: modelReturning("Title", (options) => {
        sent = options.prompt;
      }),
      maxRetries: 0,
    });

    // Either shape the SDK may hand the model: the point is that a huge prompt
    // is not resent in full just to name the conversation.
    expect(JSON.stringify(sent)).not.toContain("x".repeat(2001));
  });
});

describe("titleConversation", () => {
  it("returns a stored title without asking the model again", async () => {
    mocks.conversation = { title: "Schema planning" };
    let called = false;

    const title = await titleConversation({
      conversationId: "conversation_1",
      userId: "user_1",
      model: modelReturning("Title: Another title", () => {
        called = true;
      }),
      maxRetries: 0,
    });

    expect(title).toBe("Schema planning");
    expect(called).toBe(false);
    expect(mocks.written).toEqual([]);
  });

  it("generates and stores a title from the first live user message", async () => {
    const title = await titleConversation({
      conversationId: "conversation_1",
      userId: "user_1",
      model: modelReturning("Title: Schema planning"),
      maxRetries: 0,
    });

    expect(title).toBe("Schema planning");
    expect(mocks.written).toEqual([{ title: "Schema planning" }]);
  });

  it("stores nothing when the model answered instead of naming the conversation", async () => {
    const title = await titleConversation({
      conversationId: "conversation_1",
      userId: "user_1",
      model: modelReturning("I cannot answer that question as asked."),
      maxRetries: 0,
    });

    expect(title).toBeNull();
    expect(mocks.written).toEqual([]);
  });

  it("reports a provider failure and stores nothing", async () => {
    // Swallowing it is the scheduler's job, so the service never hides an
    // outage: `startConversationTitle` logs it and the turn is unaffected.
    await expect(
      titleConversation({
        conversationId: "conversation_1",
        userId: "user_1",
        model: failingModel(),
        maxRetries: 0,
      }),
    ).rejects.toThrow("provider is down");

    expect(mocks.written).toEqual([]);
  });

  it("stores nothing when the conversation belongs to somebody else", async () => {
    mocks.conversation = null;

    const title = await titleConversation({
      conversationId: "conversation_other",
      userId: "user_1",
      model: modelReturning("Title: Schema planning"),
      maxRetries: 0,
    });

    expect(title).toBeNull();
    expect(mocks.written).toEqual([]);
  });

  it("stores nothing for a conversation nobody has written in", async () => {
    mocks.firstMessage = null;

    const title = await titleConversation({
      conversationId: "conversation_1",
      userId: "user_1",
      model: modelReturning("Title: Schema planning"),
      maxRetries: 0,
    });

    expect(title).toBeNull();
    expect(mocks.written).toEqual([]);
  });

  it("does not claim a title another attempt stored first", async () => {
    mocks.updateRows = [];

    const title = await titleConversation({
      conversationId: "conversation_1",
      userId: "user_1",
      model: modelReturning("Title: Schema planning"),
      maxRetries: 0,
    });

    expect(title).toBeNull();
  });
});
