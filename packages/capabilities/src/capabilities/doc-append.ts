import { z } from "zod";

import { can, workspaceReadOnly } from "../can";
import type { WorkspaceRecord } from "../context";
import { defineCapability } from "../define";
import { refusal, success } from "../result";

import { blockIdFor, blockWriteSchema, idempotencyKeySchema, roomRefusal } from "./doc-write";

/**
 * Appends one block at the end of the document. The same request key inserts
 * the block once, because the room owner records it with the operations; a
 * retry returns the revision the first call produced and applies nothing.
 */
export const docAppend = defineCapability<
  {
    workspaceId: string;
    idempotencyKey: string;
    block: z.infer<typeof blockWriteSchema>;
  },
  { revision: string; applied: number; blockId: string },
  WorkspaceRecord
>({
  name: "doc.append",
  description: "Append one block to a workspace document, exactly once per request key.",
  effect: "write",
  callers: ["human", "agent"],
  input: z.object({
    workspaceId: z.string().min(1),
    idempotencyKey: idempotencyKeySchema,
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
      id: blockIdFor(input.idempotencyKey),
      kind: input.block.kind,
      level: input.block.kind === "paragraph" ? null : input.block.level,
      text: input.block.text,
    };

    try {
      const result = await context.rooms.apply({
        room: { kind: "doc", id: workspace.docRoomId, accountId: workspace.accountId },
        actor: context.actor,
        idempotencyKey: input.idempotencyKey,
        ops: [{ kind: "append-block", payload: { block } }],
      });

      return success({ revision: result.revision, applied: result.applied, blockId: block.id });
    } catch (error) {
      return roomRefusal(error);
    }
  },
});
