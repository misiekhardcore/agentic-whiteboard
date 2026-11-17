import type { ContentPart, PromptMessage } from "./types";

export /**
 * A refusal is the capability's `ok: false`, or the `execution-denied` output
 * the SDK gives a tool call the person denied. Reading the structure rather
 * than the text keeps a workspace named "Denied plan" from looking refused.
 */
function refused(prompt: PromptMessage[]): boolean {
  return prompt.some(
    (message) =>
      Array.isArray(message.content) &&
      message.content.some((raw) => {
        const part = raw as ContentPart;
        if (part.type !== "tool-result") return false;

        const output = part.output;
        if (typeof output !== "object" || output === null) return false;

        const { ok, type } = output as { ok?: unknown; type?: unknown };
        return ok === false || type === "execution-denied";
      }),
  );
}
