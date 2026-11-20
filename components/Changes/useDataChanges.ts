"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { useChangesContext } from "./ChangesProvider";

/**
 * Re-runs the route when one of `keys` changes. The default reaction is a server
 * render of the page: the data being shown is read again, so there is no second
 * client-side copy of it to keep in step.
 */
export function useDataChanges(keys: string[], handler?: () => void): void {
  const context = useChangesContext();
  const router = useRouter();
  const handlerRef = useRef(handler);

  // Kept in a ref so a caller's new inline handler does not resubscribe the
  // channel on every render; the effect runs before the subscription below.
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const onChange = useCallback(() => {
    if (handlerRef.current) handlerRef.current();
    else router.refresh();
  }, [router]);

  const keyList = keys.join("\u0000");

  useEffect(() => {
    if (!context) return;

    const watched = keyList.split("\u0000").filter(Boolean);
    if (watched.length === 0) return;

    return context.subscribe(watched, onChange);
  }, [context, keyList, onChange]);
}
