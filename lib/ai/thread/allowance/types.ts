import { type PromptUsage, type UsageWindow } from "@/lib/billing/usage";

export type PromptAllowance = {
  usage: PromptUsage;
  window: UsageWindow;
  /** The sentence to show instead of sending, or null when there is room. */
  message: string | null;
};
