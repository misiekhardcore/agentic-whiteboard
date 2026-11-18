import { expect, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * The interface is told what changed instead of being reloaded to find out.
 *
 * A tab's own action refreshes from the server action's response, a prompt's tab
 * re-reads from the datasets the stream announces, and another tab re-reads on
 * focus (a broadcast does the same when the stack is configured, which the suite
 * does not start). These specs drive the first two and the focus fallback.
 */

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

    // The other tab hears about it when the window regains focus, which is the
    // floor under a change it could not receive (a socket that is down, an
    // event sent while the tab slept).
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("link", { name: workspaceName })).toBeVisible();
  } finally {
    await deleteAccount(email);
  }
});
