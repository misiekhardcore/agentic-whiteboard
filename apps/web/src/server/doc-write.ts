import { docAppend, invoke } from "@v2/capabilities";
import type { CapabilityContext } from "@v2/capabilities";
import type { Result } from "@v2/contracts";

/**
 * The temporary control's block. It is deliberately fixed: the browser sends
 * only a request key, so the control can demonstrate the server write path
 * without turning into a general document editor.
 */
export const TEMPLATE_BLOCK = {
  kind: "paragraph",
  level: null,
  text: "Inserted from template",
} as const;

export type TemplateInsertion = {
  revision: string;
  applied: number;
  blockId: string;
};

/**
 * The exact capability the agent will call. The control uses a stable request
 * key, so activating it twice returns `applied: 0` and leaves one block.
 */
export function insertTemplateBlock({
  workspaceId,
  idempotencyKey,
  context,
}: {
  workspaceId: string;
  idempotencyKey: string;
  context: CapabilityContext;
}): Promise<Result<TemplateInsertion>> {
  return invoke(docAppend, context, {
    workspaceId,
    idempotencyKey,
    block: TEMPLATE_BLOCK,
  });
}
