import { z } from "zod";

import { workspaceReadOnly } from "../can";
import type { WorkspaceRecord } from "../context";
import { defineCapability } from "../define";
import { refusal, success } from "../result";

import { authorizeDocWrite, roomRefusal } from "./doc-write";

/**
 * Persists the document now and answers the revision it holds. A person's save
 * (Ctrl+S) goes through here, so the room counts whatever the debounce has not
 * counted yet and the snapshot lands immediately. The lifecycle rule is the
 * same one every document write uses: an archived workspace refuses.
 */
export const docSave = defineCapability<
  { workspaceId: string },
  { revision: string },
  WorkspaceRecord
>({
  name: "doc.save",
  description: "Persist a workspace document now and return the revision it holds.",
  effect: "write",
  callers: ["human"],
  input: z.object({ workspaceId: z.string().min(1) }),
  output: z.object({ revision: z.string() }),
  authorize: (context, input) => authorizeDocWrite(context, input.workspaceId),
  run: async (context, _input, workspace) => {
    if (workspaceReadOnly(workspace)) {
      return refusal("read-only", "This workspace is archived and the document refuses writes.");
    }

    try {
      const saved = await context.rooms.save({
        kind: "doc",
        id: workspace.docRoomId,
        accountId: workspace.accountId,
      });

      return success({ revision: saved.revision });
    } catch (error) {
      return roomRefusal(error);
    }
  },
});
