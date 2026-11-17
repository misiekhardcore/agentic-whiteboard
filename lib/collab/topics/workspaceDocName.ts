import { workspaceTopic } from "./workspaceTopic";

/** Hocuspocus document name for a workspace's document surface. */
export function workspaceDocName(workspaceId: string): string {
  return `${workspaceTopic(workspaceId)}:doc`;
}
