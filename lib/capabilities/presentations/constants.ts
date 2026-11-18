import { workspacePresentations } from "@/lib/workspace/presentation";

import type { ToolPresentation } from "../presentation";
/** Tools the browser performs; they never have a server result to wait for. */
export const CLIENT_TOOL_NAMES: readonly string[] = ["openWorkspace"];

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
