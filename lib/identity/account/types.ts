import type { AccountContext } from "@/lib/organizations/contracts";

import type { Session } from "./internals";

export type SessionAccountContext = AccountContext & { session: Session };
