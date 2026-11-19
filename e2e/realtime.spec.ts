import { expect, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * The live path the rest of the suite stands in for.
 *
 * The other live-update specs run against a broadcast sink: they prove the app
 * published the right keys, and they reach a second tab by dispatching a focus
 * event. This spec runs with a real stack behind it (`pnpm db:up`, then
 * `pnpm test:e2e:realtime`) and asserts the parts a sink cannot: the tab joins
 * its private channel, the broadcast arrives over that socket, and a tab that
 * never gained focus re-reads the page anyway.
 *
 * A break in the token route, the RLS policy, the channel name or the publish
 * all end with the change never reaching this tab, because the focus fallback
 * is not what this spec relies on.
 */

declare global {
  interface Window {
    __focusEvents?: number;
  }
}

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Realtime Tester");
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

test("a tab that never gained focus re-reads the page from a broadcast", async ({
  context,
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-realtime-${id}@example.com`;
  const workspaceName = `Broadcast ${id}`;

  await context.addInitScript(() => {
    window.__focusEvents = 0;
    window.addEventListener("focus", () => {
      window.__focusEvents = (window.__focusEvents ?? 0) + 1;
    });
  });

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    // The tab under test is opened first and never brought to the front, so it
    // is a background tab for the whole run.
    const background = await context.newPage();
    const frames: string[] = [];
    const tokenAnswers: number[] = [];

    background.on("websocket", (socket) => {
      socket.on("framereceived", (frame) => frames.push(String(frame.payload)));
    });
    background.on("response", (response) => {
      if (response.url().includes("/api/realtime/token")) tokenAnswers.push(response.status());
    });

    await background.goto("/workspaces");
    await expect(background.getByText("No workspaces in Personal account")).toBeVisible();

    // 204 would mean this deployment has no stack configured, and a refused
    // join would mean the policy does not authorize this person's topic.
    await expect.poll(() => tokenAnswers).toContain(200);
    await expect
      .poll(() =>
        frames.filter(
          (frame) => frame.includes("phx_reply") && frame.includes("realtime:app:user:"),
        ),
      )
      .not.toHaveLength(0);

    const focusEvents = await background.evaluate(() => window.__focusEvents ?? 0);

    await page.bringToFront();
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Create new workspace" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Workspace name").fill(workspaceName);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("link", { name: workspaceName })).toBeVisible();

    // The background tab never asks the server; the change arrives on its own
    // socket and moves it to re-read the route.
    await expect(background.getByRole("link", { name: workspaceName })).toBeVisible({
      timeout: 20_000,
    });
    await expect
      .poll(() => frames.filter((frame) => frame.includes("data.changed")).length)
      .toBeGreaterThan(0);
    expect(frames.some((frame) => frame.includes('"workspaces"'))).toBe(true);

    // Nothing focused the tab on the way: the update cannot be the fallback.
    expect(await background.evaluate(() => window.__focusEvents ?? 0)).toBe(focusEvents);
  } finally {
    await deleteAccount(email);
  }
});
