import { messageText } from "./messageText";
import { storedParts } from "./storedParts";

/** The prose of a stored row, without its tool calls. */
export function storedText(content: unknown): string {
  return messageText(storedParts(content));
}
