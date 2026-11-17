import { workspacePresentations } from "@/lib/workspace/presentation";

import type { ToolPresentation } from "../presentation";

/**
 * The thread's labels for every capability, in one client-safe map.
 *
 * Each context exports its own presenters; this module only collects them, so
 * the client imports presenter functions and never a capability definition
 * (which imports the context's service and, through it, the database).
 * `presentations.test.ts` fails if this map and the registry disagree.
 */
export const toolPresentations: Record<string, (input: unknown) => ToolPresentation> = {
  ...workspacePresentations,
};
