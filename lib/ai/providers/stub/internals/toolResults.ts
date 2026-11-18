import type { ContentPart, PromptMessage } from "./types";

export /** Everything a tool returned, as text, so an id can be read back out. */
function toolResults(prompt: PromptMessage[]): string {
  return prompt
    .flatMap((message) =>
      Array.isArray(message.content)
        ? message.content.flatMap((raw) => {
            const part = raw as ContentPart;
            return part.type === "tool-result" ? [JSON.stringify(part.output)] : [];
          })
        : [],
    )
    .join("\n");
}
