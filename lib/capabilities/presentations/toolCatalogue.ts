import { workspaceToolPresentations } from "@/lib/workspace/presentation";

import type { ToolCatalogue } from "../presentation";

/**
 * The thread's labels for every tool, in one client-safe map.
 *
 * Each context exports its own lines; this module only collects them, so the
 * client imports labels and never a capability definition (which imports the
 * context's service and, through it, the database). `presentations.test.ts`
 * fails if this map and the registry disagree.
 */
export const toolCatalogue: ToolCatalogue = {
  ...workspaceToolPresentations,
};
