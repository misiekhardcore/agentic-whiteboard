import { expect, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * The interface is told what changed instead of being reloaded to find out.
 *
 * A tab's own action refreshes from the server action's response, a prompt's tab
 * re-reads from the datasets the stream announces, and another tab re-reads on
 * focus (a broadcast does the same when the stack is configured, which the suite
 * does not start). These specs drive the first two and the focus fallback, and
 * assert that the change keys left the server on the person's channel: the
 * broadcast sink in `scripts/` records them, so a capability that stops
 * publishing, or a channel name that drifts from the token route's, fails here.
 */
const broadcastSinkUrl = process.env.BROADCAST_SINK_URL ?? "http://127.0.0.1:3312";

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Live Update Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

async function withDb<T>(work: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await work(db);
  } finally {
    await db.end();
  }
}

async function deleteAccount(email: string) {
  await withDb(async (db) => {
    await db
      .query(`delete from workspace where "creatorId" = (select id from "user" where email = $1)`, [
        email,
      ])
      .catch(() => undefined);
    await db.query('delete from "user" where email = $1', [email]).catch(() => undefined);
  });
}

type PublishedBatch = { topic: string; keys: string[] };

/**
 * The change keys the app published for this person's channel, oldest first.
 * The channel name is the one `personChangesTopic` builds, which is also what
 * the token route hands the browser, so a mismatch between them shows up as an
 * empty list rather than a passing spec.
 */
async function publishedKeys(email: string): Promise<string[]> {
  const userId = await withDb(async (db) => {
    const { rows } = await db.query<{ id: string }>('select id from "user" where email = $1', [
      email,
    ]);

    return rows[0]?.id ?? null;
  });

  if (!userId) return [];

  const response = await fetch(`${broadcastSinkUrl}/messages`);
  const { messages } = (await response.json()) as { messages: PublishedBatch[] };

  return messages
    .filter((message) => message.topic === `app:user:${userId}`)
    .flatMap((message) => message.keys);
}

/** The stored title of the person's newest conversation, once there is one. */
async function newestTitle(email: string): Promise<string | null> {
  return withDb(async (db) => {
    const { rows } = await db.query<{ title: string }>(
      `select c.title
         from "agentConversation" c
        where c."userId" = (select id from "user" where email = $1)
        order by c."updatedAt" desc
        limit 1`,
      [email],
    );

    return rows[0]?.title ?? null;
  });
}

test("a conversation's pill appears with its first prompt and carries the generated title", async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-title-${id}@example.com`;
  const prompt = "Plan the schema";

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const meter = page.getByRole("progressbar", { name: "Agent prompts usage" }).first();

    await expect(meter).toHaveAttribute("aria-valuetext", "0 of 20 used");

    await composer.fill(prompt);
    await composer.press("Enter");

    // The prompt row exists and the conversation is named by it, so both are
    // re-read from the turn's response: no reload, no focus change.
    const recent = page.getByRole("group", { name: "Recent conversations" });
    await expect(recent.getByRole("link")).toHaveCount(1);
    await expect(meter).toHaveAttribute("aria-valuetext", "1 of 20 used");

    // The turn's keys left the server before the reply finished streaming, on
    // the channel the browser subscribes to.
    await expect
      .poll(() => publishedKeys(email))
      .toEqual(expect.arrayContaining(["conversations", "account"]));

    // The scripted endpoint answers a title request with "Scripted: <prompt>",
    // so a stored title that differs from the derived one is the background
    // job's write, and the pill shows what the conversation is stored as.
    await expect.poll(() => newestTitle(email), { timeout: 30_000 }).toBe(`Scripted: ${prompt}`);

    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(recent.getByRole("link", { name: `Scripted: ${prompt}` })).toBeVisible();
  } finally {
    await deleteAccount(email);
  }
});

test("a page without a session asks for no change channels", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/realtime/token")) asked.push(request.url());
  });

  // These pages render for a visitor with no session, so a token request here
  // could only answer 401 - and the browser reports that as a console error.
  for (const path of ["/", "/sign-in", "/sign-up"]) {
    await page.goto(path);
    // The theme switcher renders only once hydrated, and picking a theme is a
    // full client commit; the mount effects that could ask for a token have then
    // already run.
    const theme = page.getByRole("radiogroup", { name: "Color theme" });
    await theme.getByRole("radio", { name: "Light" }).click();
    await expect(theme.getByRole("radio", { name: "Light" })).toBeChecked();
  }

  expect(asked).toEqual([]);
});

test("a person who signs up asks for the change channels without a reload", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-join-${id}@example.com`;
  const askedFrom: string[] = [];

  // The sign-up page does not ask, because a visitor there may have no session
  // yet; the dashboard is the first page that can join, and joining it needs no
  // reload.
  page.on("request", (request) => {
    if (request.url().includes("/api/realtime/token")) askedFrom.push(page.url());
  });

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    await expect
      .poll(() => askedFrom.filter((url) => url.endsWith("/dashboard")).length)
      .toBeGreaterThan(0);
  } finally {
    await deleteAccount(email);
  }
});

test("a workspace created in one tab reaches an open page in another", async ({
  context,
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-live-${id}@example.com`;
  const workspaceName = `Shared list ${id}`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    // This page rendered before the workspace existed and is never reloaded.
    await page.goto("/workspaces");
    await expect(page.getByText("No workspaces in Personal account")).toBeVisible();

    const other = await context.newPage();
    await other.goto("/workspaces");
    await expect(other.getByText("No workspaces in Personal account")).toBeVisible();

    await expect(async () => {
      await other.getByRole("button", { name: "Create new workspace" }).first().click();
      await expect(other.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    const dialog = other.getByRole("dialog");
    await dialog.getByLabel("Workspace name").fill(workspaceName);
    await dialog.getByRole("button", { name: "Save" }).click();

    // The tab that submitted the form re-reads the route it is on.
    await expect(other.getByRole("link", { name: workspaceName })).toBeVisible();

    // The capability's declared key reached the server's publish path, so the
    // tabs that were not submitted in have something to react to.
    await expect.poll(() => publishedKeys(email)).toContain("workspaces");

    // The other tab hears about it when the window regains focus, which is the
    // floor under a change it could not receive (a socket that is down, an
    // event sent while the tab slept).
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("link", { name: workspaceName })).toBeVisible();
  } finally {
    await deleteAccount(email);
  }
});
