"use client";

import {
  createClient,
  REALTIME_SUBSCRIBE_STATES,
  type SupabaseClient,
} from "@supabase/supabase-js";
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

import { CHANGE_EVENT, type ChangeEvent } from "@/lib/shared/changes";
import { routes } from "@/lib/shared/routes";

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

type SessionChannels = {
  url: string;
  key: string;
  token: string;
  topics: string[];
};

/**
 * One subscription per session, carrying the datasets that changed. The
 * broadcast is a hint: every reaction is a server render of data that was read
 * again, so a message that never arrives costs freshness and never truth.
 *
 * Channels are joined once the token endpoint answers. A re-subscription and a
 * window focus both refresh the route, which is what covers an event missed
 * while the socket was down or the tab was asleep.
 */
export function ChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const handlers = useRef(new Map<string, Set<ChangeHandler>>());
  const refreshedOnce = useRef(false);
  const joined = useRef<SupabaseClient | null>(null);
  const joining = useRef(false);

  const applyChanges = useCallback((keys: string[]) => {
    const involved = new Set<ChangeHandler>();

    for (const key of keys) {
      for (const handler of handlers.current.get(key) ?? []) involved.add(handler);
    }

    for (const handler of involved) handler();
  }, []);

  const join = useCallback(async () => {
    if (joined.current || joining.current) return;
    joining.current = true;

    try {
      const response = await fetch(routes.realtimeTokenApi);
      // 204 means this deployment has no Realtime; every page still refreshes
      // on focus, so there is nothing to join.
      if (!response.ok || response.status === 204) return;

      const session = (await response.json()) as SessionChannels;
      const client = createClient(session.url, session.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await client.realtime.setAuth(session.token);

      for (const topic of session.topics) {
        const channel = client.channel(topic, { config: { private: true } });

        channel.on("broadcast", { event: CHANGE_EVENT }, (message) => {
          applyChanges((message.payload as ChangeEvent).keys ?? []);
        });

        channel.subscribe((status) => {
          if (status !== REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) return;
          // The first subscription is the page that is already rendered; a
          // later one is a reconnect, and may have missed a change.
          if (!refreshedOnce.current) {
            refreshedOnce.current = true;
            return;
          }
          router.refresh();
        });
      }

      joined.current = client;
    } catch (error) {
      console.error("[changes] could not join the change channels", error);
    } finally {
      joining.current = false;
    }
  }, [applyChanges, router]);

  // A page rendered signed out has nothing to join, and the page a person lands
  // on after signing up is the first that does, so each navigation asks again.
  useEffect(() => {
    void join();
  }, [join, pathname]);

  useEffect(
    () => () => {
      const client = joined.current;
      joined.current = null;
      if (client) void client.removeAllChannels();
    },
    [],
  );

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
