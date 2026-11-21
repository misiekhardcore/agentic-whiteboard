/**
 * The view sent with a prompt: the path the person is on, plus the workspace
 * when they are looking at one. Computed at send time from the live location so
 * "this workspace" keeps working after a navigation, and validated on the
 * server before it reaches the instructions.
 */
export function composerView(pathname: string): {
  pathname: string;
  workspaceId?: string;
} {
  const onWorkspace = /^\/workspaces\/([A-Za-z0-9_-]+)/.exec(pathname);

  return onWorkspace ? { pathname, workspaceId: onWorkspace[1] } : { pathname };
}
