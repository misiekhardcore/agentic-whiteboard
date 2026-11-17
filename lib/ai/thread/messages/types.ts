import { type PromptTarget } from "@/lib/ai/thread/rules";

/**
 * The message rows a prompt is made of: the person's text written before the
 * stream starts, the agent's reply written when it ends, and the lookup that
 * turns the message a send repeats into the stored prompt it continues.
 *
 * The prompt's text lives here and not on the prompt row, so the thread and the
 * model read one copy of what was asked.
 */
export type UserPromptTarget = PromptTarget & {
  /** The prompt's place in the conversation, for a rewind's discard set. */
  createdAt: Date;
};
