import { STUB_USAGE } from "./STUB_USAGE";

export /**
 * The reply as word-sized deltas, the way a real model streams. Keeping the
 * whitespace with each word means the deltas rejoin to exactly the scripted
 * answer, while the client can render and speak a sentence before the rest of
 * the reply exists.
 */
function textChunks(text: string) {
  const words = text.match(/\S+\s*/g) ?? [];

  return [
    { type: "stream-start" as const, warnings: [] },
    { type: "text-start" as const, id: "stub-text" },
    ...words.map((delta) => ({ type: "text-delta" as const, id: "stub-text", delta })),
    { type: "text-end" as const, id: "stub-text" },
    {
      type: "finish" as const,
      finishReason: { unified: "stop" as const, raw: "stop" },
      usage: STUB_USAGE,
    },
  ];
}
