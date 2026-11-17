import { STUB_REPLY_PREFIX } from "../constants";

export /**
 * Both scripted replies are markdown, like a real reply, so the rendered thread
 * is what the e2e suite sees rather than the raw syntax.
 */
function stubPlainReply(userText: string): string {
  return `**${STUB_REPLY_PREFIX}** ${userText}`;
}
