import { workspaceTopic } from "./workspaceTopic";

/** Hocuspocus document name for a workspace's canvas surface. */
export function workspaceCanvasName(workspaceId: string): string {
  return `${workspaceTopic(workspaceId)}:canvas`;
}
