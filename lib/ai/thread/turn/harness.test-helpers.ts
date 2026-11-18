import type { UIMessage } from "ai";
import { vi } from "vitest";

import type { SessionAccountContext } from "@/lib/identity/account";

import { runDashboardTurn } from "./runDashboardTurn";

/**
 * The turn's job at this boundary is to answer from what it persisted. The
 * tests drive it with a body that disagrees with the conversation — a discarded
 * branch, an invented reply — and assert on what the agent was actually given.
 *
 * Everything the turn reads or writes is mocked at the module boundary, so the
 * assertion is about the one thing under test: the messages handed to the model.
 * The factories only read `mocks` when they are called, so hoisting them above
 * the module body is safe.
 */
const state = vi.hoisted(() => {
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

/** Exported separately: a hoisted binding cannot be exported directly. */
export const mocks = state;

vi.mock("ai", () => ({
  createAgentUIStreamResponse: vi.fn((options: Record<string, unknown>) => {
    mocks.streamed.push(options);
    return Promise.resolve(new Response("stream"));
  }),
  generateId: () => "generated_message_id",
}));

vi.mock("../allowance", () => ({
  promptAllowance: vi.fn(() => Promise.resolve({ message: null })),
}));

vi.mock("../approvals", () => ({
  findAwaitingApprovalPrompt: vi.fn(() => Promise.resolve(mocks.waiting)),
}));

vi.mock("../messages", () => ({
  findUserPromptTarget: vi.fn(() => Promise.resolve(mocks.target)),
  appendUserPromptMessage: vi.fn((options: { messageId?: string }) => {
    mocks.stored.push(options);
    return Promise.resolve();
  }),
  appendAssistantPromptMessage: vi.fn(),
}));

vi.mock("../prompts", () => ({
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

vi.mock("../conversations", () => ({
  loadPromptHistory: vi.fn(() => Promise.resolve(mocks.history)),
}));

vi.mock("@/lib/ai/providers/config", () => ({
  AiConfigurationError: class AiConfigurationError extends Error {},
  getAiConfig: () => ({
    model: "scripted-model",
    baseURL: "http://127.0.0.1:3311/v1",
    apiKey: "scripted",
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

export const account = {
  session: { user: { id: "user_1", name: "Ann" } },
  activeTeam: null,
} as unknown as SessionAccountContext;

export function userMessage(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

export function assistantMessage(id: string, parts: UIMessage["parts"]): UIMessage {
  return { id, role: "assistant", parts };
}

export function approvalPart(
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

export const parkedHistory: UIMessage[] = [
  userMessage("message_user", "Archive it"),
  assistantMessage("stored_reply", [
    { type: "text", text: "Archiving needs your approval." },
    approvalPart("approval-requested"),
  ]),
];

export async function send(payload: unknown): Promise<Response> {
  return runDashboardTurn({
    payload,
    account,
    signal: new AbortController().signal,
  });
}

export const body = (messages: UIMessage[]) => ({
  conversationId: "conversation_1",
  messages,
});

/** Put the knobs back between tests without restating all of them. */
export function resetMocks(): void {
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
}
