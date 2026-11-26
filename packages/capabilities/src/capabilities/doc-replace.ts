import { z } from "zod";

import { can, workspaceReadOnly } from "../can";
import type { WorkspaceRecord } from "../context";
import { defineCapability } from "../define";
import { refusal, success } from "../result";

import { blockIdSchema, blockWriteSchema, idempotencyKeySchema, roomRefusal } from "./doc-write";

/**
 * Replaces one block by identity. The block keeps its id and position, so a
 * concurrent human edit above it is not rewritten, and a replay changes
 * nothing because the owner recorded the request key with the operation.
 */
export const docReplace = defineCapability<
  {
    workspaceId: string;
    idempotencyKey: string;
    blockId: string;
    block: z.infer<typeof blockWriteSchema>;
  },
  { revision: string; applied: number; blockId: string },
  WorkspaceRecord
>({
  name: "doc.replace",
  description: "Replace one block in a workspace document by its identity, exactly once per key.",
  effect: "write",
  callers: ["human", "agent"],
  input: z.object({
    workspaceId: z.string().min(1),
    idempotencyKey: idempotencyKeySchema,
    blockId: blockIdSchema,
    block: blockWriteSchema,
  }),
  output: z.object({ revision: z.string(), applied: z.number().int(), blockId: z.string() }),
  authorize: async (context, input) => {
    const workspace = await context.workspaces.findById(input.workspaceId);
    if (workspace === null) return null;
    return can(context.actor, "workspace.read", workspace) ? workspace : null;
  },
  run: async (context, input, workspace) => {
    if (workspaceReadOnly(workspace)) {
      return refusal("read-only", "This workspace is archived and the document refuses writes.");
    }

    const block = {
      id: input.blockId,
      kind: input.block.kind,
      level: input.block.kind === "paragraph" ? null : input.block.level,
      text: input.block.text,
    };

    try {
      const result = await context.rooms.apply({
        room: { kind: "doc", id: workspace.docRoomId, accountId: workspace.accountId },
        actor: context.actor,
        idempotencyKey: input.idempotencyKey,
        ops: [{ kind: "replace-block", payload: { blockId: input.blockId, block } }],
      });

      return success({ revision: result.revision, applied: result.applied, blockId: block.id });
    } catch (error) {
      return roomRefusal(error);
    }
  },
});
