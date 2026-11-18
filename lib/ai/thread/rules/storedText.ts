import { storedParts } from "./storedParts";

/** The prose of a stored row, without its tool calls. */
export function storedText(content: unknown): string {
  return storedParts(content)
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");
}
