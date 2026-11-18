export /** Reads a name out of "create a workspace called X"; falls back to a placeholder. */
function requestedWorkspaceName(text: string): string {
  const match =
    /(?:called|named)\s+"([^"]+)"/i.exec(text) ?? /(?:called|named)\s+([^.\n]+)/i.exec(text);

  return match?.[1]?.trim() || "New workspace";
}
