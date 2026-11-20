"use client";

import { useDataChanges } from "./useDataChanges";

/**
 * The whole reaction most server-rendered pages need: name the datasets the
 * page shows, and a change to any of them re-renders it. Rendered inside a
 * server component, it costs no markup.
 */
export function RefreshOnChanges({ keys }: { keys: string[] }) {
  useDataChanges(keys);
  return null;
}
