export function firstWorkspaceId(results: string): string | null {
  return (
    /"workspaceId":"([^"]+)"/.exec(results)?.[1] ??
    /"workspace":\{"id":"([^"]+)"/.exec(results)?.[1] ??
    /"id":"([^"]+)"/.exec(results)?.[1] ??
    null
  );
}
