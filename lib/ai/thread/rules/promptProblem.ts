import { PROMPT_MAX_LENGTH } from "./PROMPT_MAX_LENGTH";

/**
 * What is wrong with a draft, or `null` when it can be sent. The route re-checks
 * the prompt even though the composer disables sending: the endpoint is the
 * trust boundary, and an empty or oversized prompt must not create a record.
 */
export function promptProblem(prompt: string): string | null {
  if (prompt.trim().length === 0) {
    return "Write a prompt so the agent knows what to plan.";
  }

  if (prompt.trim().length > PROMPT_MAX_LENGTH) {
    return `Keep the prompt under ${PROMPT_MAX_LENGTH.toLocaleString("en-US")} characters.`;
  }

  return null;
}
