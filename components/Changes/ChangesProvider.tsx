"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { followsLiveChanges } from "@/lib/shared/routes";

import { useChangeChannels } from "./useChangeChannels";

type ChangeHandler = () => void;

type ChangesContextValue = {
  /** Registers a handler for the keys a component shows; returns its unsubscribe. */
  subscribe: (keys: string[], handler: ChangeHandler) => () => void;
  /**
   * Announces keys that changed outside the socket: the response to a prompt
   * names its own, so the tab that sent it does not wait for a broadcast.
   */
  applyChanges: (keys: string[]) => void;
};

const ChangesContext = createContext<ChangesContextValue | null>(null);

/**
 * The registry of what each mounted component shows, and the one socket that
 * tells it when one of those datasets changed. The socket lives in
 * `useChangeChannels`; this component only routes keys to handlers.
 *
 * A broadcast is a hint: every reaction is a server render of data that was
 * read again, so a message that never arrives costs freshness and never truth.
 * Window focus is the fallback for an event missed while the tab was asleep.
 */
export function ChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const handlers = useRef(new Map<string, Set<ChangeHandler>>());

  const applyChanges = useCallback((keys: string[]) => {
    const involved = new Set<ChangeHandler>();

    for (const key of keys) {
      for (const handler of handlers.current.get(key) ?? []) involved.add(handler);
    }

    for (const handler of involved) handler();
  }, []);

  const refresh = useCallback(() => router.refresh(), [router]);

  useChangeChannels({
    onKeys: applyChanges,
    onReconnect: refresh,
    rejoinOn: pathname,
    enabled: followsLiveChanges(pathname),
  });

  useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);

    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  const value = useMemo<ChangesContextValue>(
    () => ({
      subscribe(keys, handler) {
        for (const key of keys) {
          const handlersFor = handlers.current.get(key) ?? new Set<ChangeHandler>();
          handlersFor.add(handler);
          handlers.current.set(key, handlersFor);
        }

        return () => {
          for (const key of keys) {
            handlers.current.get(key)?.delete(handler);
          }
        };
      },
      applyChanges,
    }),
    [applyChanges],
  );

  return <ChangesContext.Provider value={value}>{children}</ChangesContext.Provider>;
}

/** The subscription registry, for components that react to their own keys. */
export function useChangesContext(): ChangesContextValue | null {
  return useContext(ChangesContext);
}
