import { STUB_USAGE } from "./STUB_USAGE";

export function toolCallChunks(toolName: string, input: Record<string, unknown>) {
  const encoded = JSON.stringify(input);
  const id = `stub-${toolName}`;

  return [
    { type: "stream-start" as const, warnings: [] },
    { type: "tool-input-start" as const, id, toolName },
    { type: "tool-input-delta" as const, id, delta: encoded },
    { type: "tool-input-end" as const, id },
    {
      type: "tool-call" as const,
      toolCallId: id,
      toolName,
      input: encoded,
    },
    {
      type: "finish" as const,
      finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
      usage: STUB_USAGE,
    },
  ];
}
