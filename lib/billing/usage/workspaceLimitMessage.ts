import { upgradeMessages } from "../plans";

import { fillUpgradeCopy } from "./fillUpgradeCopy";

/**
 * The message a create attempt returns when the account has no workspace slots
 * left. `null` means the account still has room, including on unlimited plans.
 */
export function workspaceLimitMessage({
  used,
  limit,
  plan,
  accountName,
}: {
  used: number;
  limit: number | null;
  plan: string;
  accountName: string;
}): string | null {
  if (limit === null || used < limit) return null;

  return fillUpgradeCopy(upgradeMessages.workspaces.description, {
    used: used.toLocaleString("en-US"),
    limit: limit.toLocaleString("en-US"),
    plan,
    account: accountName,
  });
}
