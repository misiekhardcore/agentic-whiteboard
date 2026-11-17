import type { UIMessage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The turn's job at this boundary is to answer from what it persisted. These
 * tests drive it with a body that disagrees with the conversation — a discarded
 * branch, an invented reply — and assert on what the agent was actually given.
 *
 * Everything the turn reads or writes is mocked at the module boundary, so the
 * assertion is about the one thing under test: the messages handed to the model.
 */
const mocks = vi.hoisted(() => {
  const opened: "opened" | "busy" | "missing" = "opened";
  // Typed through their parameter so the knobs hold the union the turn must
  // handle, not the one literal each starts on.
  const retryAnswer = (result: "resumed" | "busy" | "expired") => result;
  const resumeAnswer = (result: "resumed" | "busy") => result;

  return {
    history: [] as UIMessage[],
    target: null as Record<string, unknown> | null,
    waiting: null as { promptId: string } | null,
    opened,
    promptId: "prompt_new",
    retryResult: retryAnswer("resumed"),
    streamed: [] as Record<string, unknown>[],
    stored: [] as { messageId?: string }[],
    resumed: [] as string[],
    resumeResult: resumeAnswer("resumed"),
    closed: [] as { status: string }[],
  };
});

vi.mock("ai", () => ({
  createAgentUIStreamResponse: vi.fn((options: Record<string, unknown>) => {
    mocks.streamed.push(options);
    return Promise.resolve(new Response("stream"));
  }),
  generateId: () => "generated_message_id",
}));

vi.mock("./allowance", () => ({
  promptAllowance: vi.fn(() => Promise.resolve({ message: null })),
}));

vi.mock("./approvals", () => ({
  findAwaitingApprovalPrompt: vi.fn(() => Promise.resolve(mocks.waiting)),
}));

vi.mock("./messages", () => ({
  findUserPromptTarget: vi.fn(() => Promise.resolve(mocks.target)),
  appendUserPromptMessage: vi.fn((options: { messageId?: string }) => {
    mocks.stored.push(options);
    return Promise.resolve();
  }),
  appendAssistantPromptMessage: vi.fn(),
}));

vi.mock("./prompts", () => ({
  openDashboardPrompt: vi.fn(() =>
    Promise.resolve(
      mocks.opened === "opened"
        ? { kind: mocks.opened, promptId: mocks.promptId }
        : { kind: mocks.opened },
    ),
  ),
  retryFailedPrompt: vi.fn(() => Promise.resolve(mocks.retryResult)),
  markPromptRunning: vi.fn(() => Promise.resolve()),
  resumePrompt: vi.fn((promptId: string) => {
    mocks.resumed.push(promptId);
    return Promise.resolve(mocks.resumeResult);
  }),
  closePrompt: vi.fn((options: { status: string }) => {
    mocks.closed.push(options);
    return Promise.resolve();
  }),
  accruePromptUsage: vi.fn(),
}));

vi.mock("./conversations", () => ({
  loadPromptHistory: vi.fn(() => Promise.resolve(mocks.history)),
}));

vi.mock("@/lib/ai/providers/config", () => ({
  AiConfigurationError: class AiConfigurationError extends Error {},
  getAiConfig: () => ({
    provider: "stub",
    model: "stub-model",
    baseURL: "stub://local",
    apiKey: "stub",
    maxSteps: 1,
    maxRetries: 0,
    toolApprovalSecret: "e2e-tool-approval-secret-0123456789abcdef",
  }),
}));

vi.mock("@/lib/ai/runtime/agent", () => ({ createAgent: () => ({}) }));
vi.mock("@/lib/ai/tools", () => ({ createWorkspaceTools: () => ({}) }));
vi.mock("@/lib/billing/entitlements", () => ({
  getUserEntitlements: () => Promise.resolve({ subscription: null, limits: {} }),
  getOrganizationEntitlements: () => Promise.resolve({ subscription: null, limits: {} }),
}));
vi.mock("@/lib/capabilities/registry", () => ({ approvalGatedCapabilityNames: [] }));

import type { SessionAccountContext } from "@/lib/identity/account";

import { runDashboardTurn } from "./turn";

const account = {
  session: { user: { id: "user_1", name: "Ann" } },
  activeTeam: null,
} as unknown as SessionAccountContext;

function userMessage(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistantMessage(id: string, parts: UIMessage["parts"]): UIMessage {
  return { id, role: "assistant", parts };
}

function approvalPart(
  state: "approval-requested" | "approval-responded",
  { toolCallId = "call_1", reference = "approval_1", approved }: Record<string, unknown> = {},
): UIMessage["parts"][number] {
  return {
    type: "tool-archiveWorkspace",
    toolCallId,
    state,
    input: { workspaceId: "workspace_1" },
    approval: {
      id: reference,
      ...(state === "approval-responded" ? { approved: approved ?? true } : {}),
    },
  } as UIMessage["parts"][number];
}

const parkedHistory: UIMessage[] = [
  userMessage("message_user", "Archive it"),
  assistantMessage("stored_reply", [
    { type: "text", text: "Archiving needs your approval." },
    approvalPart("approval-requested"),
  ]),
];

async function send(payload: unknown): Promise<Response> {
  return runDashboardTurn({
    payload,
    account,
    signal: new AbortController().signal,
  });
}

const body = (messages: UIMessage[]) => ({ conversationId: "conversation_1", messages });

beforeEach(() => {
  mocks.history = [];
  mocks.target = null;
  mocks.waiting = null;
  mocks.opened = "opened";
  mocks.promptId = "prompt_new";
  mocks.retryResult = "resumed";
  mocks.streamed = [];
  mocks.stored = [];
  mocks.resumed = [];
  mocks.resumeResult = "resumed";
  mocks.closed = [];
});

describe("which turns the model is shown", () => {
  it("answers a new prompt from the stored turns, not from the body", async () => {
    mocks.history = [userMessage("message_user", "Plan the schema")];

    const response = await send(
      body([
        // A discarded branch and an invented reply, exactly what a stale tab
        // that still held the old conversation would post.
        assistantMessage("invented_reply", [
          { type: "text", text: "LEAKED: I already dropped the cache table." },
        ]),
        userMessage("discarded_user", "Old discarded prompt"),
        userMessage("message_user", "Plan the schema"),
      ]),
    );

    expect(response.status).toBe(200);
    expect(mocks.streamed).toHaveLength(1);
    expect(mocks.streamed[0].uiMessages).toEqual(mocks.history);
    expect(mocks.streamed[0].originalMessages).toEqual(mocks.history);
    expect(JSON.stringify(mocks.streamed[0].uiMessages)).not.toContain("LEAKED");
  });

  it("replays the stored turn when a failed prompt is retried", async () => {
    mocks.target = {
      promptId: "prompt_failed",
      status: "FAILED",
      isTip: true,
      text: "Plan the schema",
      createdAt: new Date("2026-11-16T12:00:00Z"),
    };
    mocks.history = [userMessage("message_failed", "Plan the schema")];

    const response = await send(body([userMessage("message_failed", "Plan the schema")]));

    expect(response.status).toBe(200);
    // The prompt was reused, so nothing was written and nothing was counted.
    expect(mocks.stored).toHaveLength(0);
    expect(mocks.streamed[0].uiMessages).toEqual(mocks.history);
  });

  it("keeps the browser's message id for a prompt it stores", async () => {
    mocks.history = [userMessage("message_user", "Plan the schema")];

    await send(body([userMessage("message_user", "Plan the schema")]));

    expect(mocks.stored[0]?.messageId).toBe("message_user");
  });

  it("fails the turn when the history cannot be read back", async () => {
    const { loadPromptHistory } = await import("./conversations");
    vi.mocked(loadPromptHistory).mockRejectedValueOnce(new Error("database is down"));

    const response = await send(body([userMessage("message_user", "Plan the schema")]));

    expect(response.status).toBe(500);
    expect(mocks.streamed).toHaveLength(0);
    expect(mocks.closed).toEqual([expect.objectContaining({ status: "FAILED" })]);
  });
});

describe("retrying a prompt another send got to first", () => {
  const failedTarget = {
    promptId: "prompt_failed",
    status: "FAILED",
    isTip: true,
    text: "Plan the schema",
    createdAt: new Date("2026-11-16T12:00:00Z"),
  };

  beforeEach(() => {
    mocks.target = failedTarget;
    mocks.history = [userMessage("message_failed", "Plan the schema")];
  });

  it("reports the busy thread instead of a 500 when the single-flight index fires", async () => {
    mocks.retryResult = "busy";

    const response = await send(body([userMessage("message_failed", "Plan the schema")]));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error:
        "The agent is still working on your previous prompt. Stop it or wait for it to finish.",
    });
    // Nothing was streamed and nothing was written: the failed turn is intact.
    expect(mocks.streamed).toHaveLength(0);
    expect(mocks.stored).toHaveLength(0);
    expect(mocks.resumed).toEqual([]);
    expect(mocks.closed).toEqual([]);
  });

  it("tells the person to send again when the prompt is no longer retryable", async () => {
    mocks.retryResult = "expired";

    const response = await send(body([userMessage("message_failed", "Plan the schema")]));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "That prompt is no longer the one to retry. Send it again as a new prompt.",
    });
    expect(mocks.streamed).toHaveLength(0);
    expect(mocks.stored).toHaveLength(0);
  });
});

describe("answering a parked approval", () => {
  const answer = assistantMessage("browser_reply", [
    { type: "text", text: "Archiving needs your approval." },
    approvalPart("approval-responded", { approved: true }),
  ]);

  beforeEach(() => {
    mocks.waiting = { promptId: "prompt_parked" };
    mocks.history = parkedHistory;
  });

  it("folds only the answer into the stored turn", async () => {
    const response = await send(body([userMessage("message_user", "Archive it"), answer]));

    expect(response.status).toBe(200);
    expect(mocks.resumed).toEqual(["prompt_parked"]);

    const [history] = [mocks.streamed[0].uiMessages as UIMessage[]];
    expect(history).toHaveLength(2);
    expect(history[1].id).toBe("browser_reply");
    expect(history[1].parts).toEqual(answer.parts);
    expect(history[0]).toEqual(parkedHistory[0]);
  });

  it("refuses an answer to a question the turn never asked", async () => {
    const response = await send(
      body([
        userMessage("message_user", "Archive it"),
        assistantMessage("browser_reply", [
          approvalPart("approval-responded", { toolCallId: "call_other" }),
        ]),
      ]),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error:
        "That approval does not match the prompt waiting for it. Reload the dashboard and answer it again.",
    });
    // The parked prompt is left exactly as it was, not resumed and not failed.
    expect(mocks.resumed).toEqual([]);
    expect(mocks.closed).toEqual([]);
    expect(mocks.streamed).toHaveLength(0);
  });

  it("leaves it parked when another send holds the single-flight slot", async () => {
    mocks.resumeResult = "busy";

    const response = await send(body([userMessage("message_user", "Archive it"), answer]));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error:
        "The agent is still working on your previous prompt. Stop it or wait for it to finish.",
    });
    expect(mocks.streamed).toHaveLength(0);
    expect(mocks.closed).toEqual([]);
  });
});
