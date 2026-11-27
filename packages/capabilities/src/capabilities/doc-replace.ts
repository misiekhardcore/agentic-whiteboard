import { z } from "zod";

import type { WorkspaceRecord } from "../context";
import { defineCapability } from "../define";

import {
  authorizeDocWrite,
  blockIdSchema,
  blockWriteSchema,
  idempotencyKeySchema,
  writeDoc,
} from "./doc-write";

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
  authorize: (context, input) => authorizeDocWrite(context, input.workspaceId),
  run: (context, input, workspace) => {
    const block = {
      id: input.blockId,
      kind: input.block.kind,
      level: input.block.kind === "paragraph" ? null : input.block.level,
      text: input.block.text,
    };

    return writeDoc(context, workspace, {
      idempotencyKey: input.idempotencyKey,
      blockId: block.id,
      block,
      op: { kind: "replace-block", payload: { blockId: input.blockId, block } },
    });
  },
});
