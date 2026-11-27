import { isDocProjection } from "@v2/contracts";
import type { DocBlock, Snapshot } from "@v2/contracts";
import { z } from "zod";

import { can } from "../can";
import type { WorkspaceRecord } from "../context";
import { defineCapability } from "../define";
import { refusal, success } from "../result";

const blockSchema = z.object({
  id: z.string(),
  kind: z.string(),
  level: z.number().nullable(),
  text: z.string(),
  updatedBy: z.string().nullable(),
});

const viewSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("outline") }),
  z.object({
    kind: z.literal("range"),
    fromBlockId: z.string().min(1),
    toBlockId: z.string().min(1),
  }),
  z.object({ kind: z.literal("search"), query: z.string().min(1) }),
]);

type DocView = z.infer<typeof viewSchema>;

/**
 * Selects the blocks a view asks for. A range names its ends by block
 * identity, so a person (or the agent) typing above it does not shift what the
 * range means. A block that no longer exists refuses the read rather than
 * silently returning the wrong slice.
 */
function selectBlocks(blocks: readonly DocBlock[], view: DocView): DocBlock[] | null {
  if (view.kind === "outline") return [...blocks];

  if (view.kind === "search") {
    const needle = view.query.toLowerCase();
    return blocks.filter((block) => block.text.toLowerCase().includes(needle));
  }

  const from = blocks.findIndex((block) => block.id === view.fromBlockId);
  const to = blocks.findIndex((block) => block.id === view.toBlockId);
  if (from === -1 || to === -1 || from > to) return null;

  return blocks.slice(from, to + 1);
}

/**
 * The document read path: outline, an identity-addressed range, or a search.
 * Content comes from the room owner behind the port, never from a second copy
 * in Postgres.
 */
export const docRead = defineCapability<
  { workspaceId: string; view: DocView },
  { revision: string; blocks: DocBlock[] },
  WorkspaceRecord
>({
  name: "doc.read",
  description:
    "Read a workspace document's outline, a range of blocks, or blocks matching a search.",
  effect: "read",
  callers: ["human", "agent"],
  input: z.object({ workspaceId: z.string().min(1), view: viewSchema }),
  output: z.object({ revision: z.string(), blocks: z.array(blockSchema) }),
  authorize: async (context, input) => {
    const workspace = await context.workspaces.findById(input.workspaceId);
    if (workspace === null) return null;
    return can(context.actor, "workspace.read", workspace) ? workspace : null;
  },
  run: async (context, input, workspace) => {
    let snapshot: Snapshot;
    try {
      snapshot = await context.rooms.snapshot({
        kind: "doc",
        id: workspace.docRoomId,
        accountId: workspace.accountId,
      });
    } catch {
      return refusal("unavailable", "The document is unavailable right now.");
    }

    if (!isDocProjection(snapshot.content)) {
      return refusal("unavailable", "The document service returned no readable content.");
    }

    const blocks = selectBlocks(snapshot.content.blocks, input.view);
    if (blocks === null) {
      return refusal("not-found", "That block is no longer in the document.");
    }

    return success({ revision: snapshot.revision, blocks });
  },
});
