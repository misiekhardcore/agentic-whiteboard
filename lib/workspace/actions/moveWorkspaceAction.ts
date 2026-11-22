"use server";

import { action } from "@/lib/capabilities/action";

import { moveWorkspace } from "../capabilities";

const move = action(moveWorkspace);

/** The board's drop entry point: a typed call, so the browser sends ids, not a position. */
export async function moveWorkspaceAction(raw: unknown) {
  return move(raw);
}
