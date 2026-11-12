import { Suspense } from "react";

import { getSessionAccount } from "@/lib/account";

import { AccountMenuPopover } from "./AccountMenuPopover";

/**
 * The avatar in the header opens this menu. It reads the session and the
 * organizations the person belongs to on the server, so the active account is
 * always the one stored in the session rather than a browser guess.
 */
export function AccountMenu() {
  return (
    <Suspense fallback={null}>
      <AccountMenuInner />
    </Suspense>
  );
}

async function AccountMenuInner() {
  const account = await getSessionAccount();

  if (!account) return null;

  const { teams, activeOrganizationId, session } = account;

  return (
    <AccountMenuPopover
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      }}
      teams={teams}
      activeOrganizationId={activeOrganizationId}
    />
  );
}
