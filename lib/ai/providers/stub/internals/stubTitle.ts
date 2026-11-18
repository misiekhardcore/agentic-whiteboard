import { STUB_TITLE_PREFIX } from "../constants";

import { latestUserText } from "./latestUserText";
import type { PromptMessage } from "./types";

/**
 * The name a title request gets. `generateText` is the app's only non-streaming
 * model call — conversation titles — so the scripted provider answers it with a
 * name derived from the quoted first message instead of the streaming reply
 * policy. The prefix keeps a stub title visibly scripted, like the replies, and
 * the `Title:` marker is what the answer parser accepts.
 */
export function stubTitle(prompt: PromptMessage[]): string {
  const request = latestUserText(prompt);
  // The request quotes the message it names; naming the wrapper instead would
  // make every scripted title start with "First message of the conversation".
  const quoted = /"""\s*\n?([\s\S]*?)\n?\s*"""/.exec(request)?.[1]?.trim();
  const words = (quoted ?? request).replace(/\s+/g, " ").trim().split(" ").slice(0, 6);

  return `Title: ${STUB_TITLE_PREFIX} ${words.join(" ")}`.trim();
}
