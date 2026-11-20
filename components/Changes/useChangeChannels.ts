"use client";

import {
  createClient,
  REALTIME_SUBSCRIBE_STATES,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { useEffect } from "react";

import { CHANGE_EVENT, type ChangeEvent } from "@/lib/shared/changes";
import { routes } from "@/lib/shared/routes";

type SessionChannels = {
  url: string;
  key: string;
  token: string;
  topics: string[];
};

/** Half the token's hour: a socket that outlives it is still authorized. */
const TOKEN_RENEW_MS = 25 * 60 * 1000;
const JOIN_ATTEMPTS = 3;
const JOIN_RETRY_MS = 2_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reads the session's channels. `null` is an answer, not a failure: a signed-out
 * visitor (401) and a deployment without Realtime (204) both have none.
 */
async function readSession(): Promise<SessionChannels | null> {
  const response = await fetch(routes.realtimeTokenApi);
  if (response.status === 401 || response.status === 204) return null;
  if (!response.ok) throw new Error(`The token endpoint answered ${response.status}.`);

  return (await response.json()) as SessionChannels;
}

/**
 * Keeps one Realtime socket joined to this session's private channels, and
 * reports what arrived: the keys that changed, and a re-join after a drop.
 *
 * The broadcast is only a hint, so every failure here is a log and a fallback —
 * the route still re-reads on focus. `rejoinOn` is what asks again after a
 * navigation, because the page a person lands on after signing in is the first
 * that has a session to join with.
 */
export function useChangeChannels({
  onKeys,
  onReconnect,
  rejoinOn,
}: {
  onKeys: (keys: string[]) => void;
  onReconnect: () => void;
  rejoinOn: string;
}): void {
  useEffect(() => {
    let cancelled = false;
    let client: SupabaseClient | null = null;
    let renewTimer: ReturnType<typeof setInterval> | undefined;

    async function connect(): Promise<void> {
      for (let attempt = 1; attempt <= JOIN_ATTEMPTS; attempt += 1) {
        try {
          const session = await readSession();
          if (cancelled || !session) return;

          const active = createClient(session.url, session.key, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          await active.realtime.setAuth(session.token);
          if (cancelled) {
            void active.removeAllChannels();
            void active.realtime.disconnect();
            return;
          }

          client = active;
          // A membership and a token both expire while a socket stays open, so
          // a fresh token is what keeps a re-join from being refused.
          renewTimer = setInterval(() => void renew(active), TOKEN_RENEW_MS);

          for (const topic of session.topics) joinTopic(active, topic);
          return;
        } catch (error) {
          if (attempt === JOIN_ATTEMPTS) {
            console.error("[changes] could not join the change channels", error);
            return;
          }
          await delay(JOIN_RETRY_MS);
          if (cancelled) return;
        }
      }
    }

    async function renew(active: SupabaseClient): Promise<void> {
      try {
        const session = await readSession();
        if (cancelled || !session) return;
        await active.realtime.setAuth(session.token);
      } catch (error) {
        console.warn("[changes] could not renew the channel token", error);
      }
    }

    function joinTopic(active: SupabaseClient, topic: string): void {
      let joinedBefore = false;
      const channel = active.channel(topic, { config: { private: true } });

      channel.on("broadcast", { event: CHANGE_EVENT }, (message) => {
        onKeys((message.payload as ChangeEvent | undefined)?.keys ?? []);
      });

      channel.subscribe((status) => {
        if (status !== REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) return;
        // The first join is the page already on screen. A later one is a
        // reconnect, which may have missed a change while it was down — the
        // first-join flag is per channel, so one topic recovering does not
        // refresh for the other's initial subscription.
        if (joinedBefore) onReconnect();
        joinedBefore = true;
      });
    }

    void connect();

    return () => {
      cancelled = true;
      if (renewTimer) clearInterval(renewTimer);

      const active = client;
      client = null;
      if (active) {
        void active.removeAllChannels();
        void active.realtime.disconnect();
      }
    };
  }, [onKeys, onReconnect, rejoinOn]);
}
