import { type CapabilityFailure } from "@/lib/capabilities/define";

import { type WorkspaceStatus } from "../status";

export type WorkspaceDraft = {
  name: string;
  description: string | null;
};

export type WorkspaceValues = {
  name: string;
  description: string | null;
  status: WorkspaceStatus;
};

export type WorkspaceMerge = { ok: true; values: WorkspaceValues } | CapabilityFailure;
