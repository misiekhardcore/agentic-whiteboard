import { type Page } from "@playwright/test";
import { createClient, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { Client } from "pg";

import { mintRealtimeToken } from "../lib/identity/realtimeToken";

/** Fills and submits the sign-up form, and waits for the dashboard it lands on. */
export async function signUp(page: Page, email: string, password: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Realtime Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

export async function withDb<T>(work: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await work(db);
  } finally {
    await db.end();
  }
}

export async function userIdOf(db: Client, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>('select id from "user" where email = $1', [
    email,
  ]);
  if (!rows[0]) throw new Error(`No user row for ${email}`);
  return rows[0].id;
}

export async function organizationIdOf(db: Client, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `select o.id
       from organization o
       join member m on m.organization_id = o.id
       join "user" u on u.id = m.user_id
      where u.email = $1
      order by o.created_at desc
      limit 1`,
    [email],
  );
  if (!rows[0]) throw new Error(`${email} is not in an organization`);
  return rows[0].id;
}

/**
 * Removes what the specs created for these accounts. The organizations go
 * first, which cascades their memberships; then the people, which cascades
 * their sessions.
 */
export async function deleteAccounts(emails: string[]) {
  await withDb(async (db) => {
    const { rows } = await db.query<{ id: string }>('select id from "user" where email = any($1)', [
      emails,
    ]);
    const userIds = rows.map((row) => row.id);
    if (userIds.length === 0) return;

    await db
      .query('delete from workspace where "creatorId" = any($1)', [userIds])
      .catch(() => undefined);
    await db
      .query(
        `delete from organization
          where id in (
            select organization_id from member where user_id = any($1)
          )`,
        [userIds],
      )
      .catch(() => undefined);
    await db.query('delete from "user" where id = any($1)', [userIds]).catch(() => undefined);
  });
}

/** A token minted the way the token route mints one, with the stack's secret. */
export function realtimeTokenFor(userId: string): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("The realtime run needs JWT_SECRET to mint a test token");

  return mintRealtimeToken({ userId, secret });
}

/**
 * What Realtime answered to a private-channel join, read from a client of its
 * own so the answer is the policy's and not a page's. A refusal arrives as
 * `CHANNEL_ERROR`; `TIMED_OUT` is reported as itself rather than folded in.
 */
export async function subscribeStatus(
  topic: string,
  token: string,
): Promise<REALTIME_SUBSCRIBE_STATES> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error("The realtime run needs NEXT_PUBLIC_SUPABASE_URL and its anon key");
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    await client.realtime.setAuth(token);
    const channel = client.channel(topic, { config: { private: true } });

    return await new Promise<REALTIME_SUBSCRIBE_STATES>((resolve) => {
      const timer = setTimeout(() => resolve(REALTIME_SUBSCRIBE_STATES.TIMED_OUT), 20_000);

      channel.subscribe((status) => {
        const settled =
          status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED ||
          status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
          status === REALTIME_SUBSCRIBE_STATES.CLOSED;
        if (!settled) return;

        clearTimeout(timer);
        resolve(status);
      });
    });
  } finally {
    await client.removeAllChannels().catch(() => undefined);
    void client.realtime.disconnect();
  }
}
