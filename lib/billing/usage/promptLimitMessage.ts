import { upgradeMessages } from "../plans";

import { fillUpgradeCopy } from "./fillUpgradeCopy";
import type { PromptUsage } from "./types";

/**
 * The message a send attempt returns when the person has used their prompt
 * allowance. `null` means there is room, including on unlimited plans. The
 * allowance is per member, so the copy names the account it belongs to rather
 * than implying the whole team shares it.
 */
export function promptLimitMessage({
  used,
  limit,
  accountName,
  periodLabel,
}: {
  used: number;
  limit: number | null;
  accountName: string;
  periodLabel: PromptUsage["periodLabel"];
}): string | null {
  if (limit === null || used < limit) return null;

  return fillUpgradeCopy(upgradeMessages.agentPromptsPerMonth.description, {
    used: used.toLocaleString("en-US"),
    limit: limit.toLocaleString("en-US"),
    period: periodLabel,
    account: accountName,
  });
}
