import { z } from "zod";

import type { WorkspaceRecord } from "../context";
import { defineCapability } from "../define";

import {
  authorizeDocWrite,
  blockIdFor,
  blockWriteSchema,
  idempotencyKeySchema,
  writeDoc,
} from "./doc-write";

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
  authorize: (context, input) => authorizeDocWrite(context, input.workspaceId),
  run: (context, input, workspace) => {
    const block = {
      id: blockIdFor(input.idempotencyKey),
      kind: input.block.kind,
      level: input.block.kind === "paragraph" ? null : input.block.level,
      text: input.block.text,
    };

    return writeDoc(context, workspace, {
      idempotencyKey: input.idempotencyKey,
      blockId: block.id,
      block,
      op: { kind: "append-block", payload: { block } },
    });
  },
});
