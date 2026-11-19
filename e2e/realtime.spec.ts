import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { organizationChangesTopic } from "../lib/shared/changes/topics";

import {
  deleteAccounts,
  organizationIdOf,
  realtimeTokenFor,
  signUp,
  subscribeStatus,
  userIdOf,
  withDb,
} from "./realtimeSupport";

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
 * is not what this spec relies on. Both topics are exercised — a personal one
 * and an organization one — and the organization channel is also asserted to
 * refuse a person who is not a member of it.
 */

declare global {
  interface Window {
    __focusEvents?: number;
  }
}

/** Counts focus on every page of the context, so an assertion can see one. */
async function countFocusEvents(context: BrowserContext) {
  await context.addInitScript(() => {
    window.__focusEvents = 0;
    window.addEventListener("focus", () => {
      window.__focusEvents = (window.__focusEvents ?? 0) + 1;
    });
  });
}

async function openBackgroundTab(page: Page) {
  const background = await page.context().newPage();
  const frames: string[] = [];
  const tokenAnswers: number[] = [];

  background.on("websocket", (socket) => {
    socket.on("framereceived", (frame) => frames.push(String(frame.payload)));
  });
  background.on("response", (response) => {
    if (response.url().includes("/api/realtime/token")) tokenAnswers.push(response.status());
  });

  return { background, frames, tokenAnswers };
}

/** 204 means no stack is configured; a refused join means the policy said no. */
async function expectJoined({
  frames,
  tokenAnswers,
  topic,
}: {
  frames: string[];
  tokenAnswers: number[];
  topic: string;
}) {
  await expect.poll(() => tokenAnswers).toContain(200);
  await expect
    .poll(() => frames.filter((frame) => frame.includes("phx_reply") && frame.includes(topic)))
    .not.toHaveLength(0);
}

test("a tab that never gained focus re-reads the page from a broadcast", async ({
  context,
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-realtime-${id}@example.com`;
  const workspaceName = `Broadcast ${id}`;

  await countFocusEvents(context);

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    // The tab under test is opened first and never brought to the front, so it
    // is a background tab for the whole run.
    const { background, frames, tokenAnswers } = await openBackgroundTab(page);

    await background.goto("/workspaces");
    await expect(background.getByText("No workspaces in Personal account")).toBeVisible();

    await expectJoined({ frames, tokenAnswers, topic: "realtime:app:user:" });

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
    await deleteAccounts([email]);
  }
});

test("an organization's shared change reaches a member's background tab", async ({
  context,
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-realtime-org-${id}@example.com`;
  const teamName = `Broadcast team ${id}`;
  const workspaceName = `Team broadcast ${id}`;

  await countFocusEvents(context);

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    // Creating an organization makes it the active account, and the shared
    // channel is the one its changes travel on.
    await page.goto("/dashboard/organization");
    await page.getByLabel("Organization name").fill(teamName);
    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(page.getByRole("heading", { name: teamName })).toBeVisible({ timeout: 15_000 });

    const organizationId = await withDb((db) => organizationIdOf(db, email));
    const topic = `realtime:${organizationChangesTopic(organizationId)}`;

    const { background, frames, tokenAnswers } = await openBackgroundTab(page);

    await background.goto("/workspaces");
    await expect(background.getByText(`No workspaces in ${teamName}`)).toBeVisible();

    await expectJoined({ frames, tokenAnswers, topic });

    const focusEvents = await background.evaluate(() => window.__focusEvents ?? 0);

    await page.bringToFront();
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Create new workspace" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Workspace name").fill(workspaceName);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("link", { name: workspaceName })).toBeVisible();

    await expect(background.getByRole("link", { name: workspaceName })).toBeVisible({
      timeout: 20_000,
    });
    // The arrival is on the organization channel: a person channel carrying it
    // would leave the members who are not the person who acted out of date.
    await expect
      .poll(
        () =>
          frames.filter(
            (frame) =>
              frame.includes("data.changed") &&
              frame.includes(topic) &&
              frame.includes('"workspaces"'),
          ).length,
      )
      .toBeGreaterThan(0);

    expect(await background.evaluate(() => window.__focusEvents ?? 0)).toBe(focusEvents);
  } finally {
    await deleteAccounts([email]);
  }
});

test("the organization channel refuses a person who is not a member", async ({ browser, page }) => {
  const id = randomUUID().slice(0, 8);
  const memberEmail = `e2e-realtime-member-${id}@example.com`;
  const outsiderEmail = `e2e-realtime-outsider-${id}@example.com`;
  const teamName = `Guarded team ${id}`;
  const password = `e2e-pass-${id}`;

  const outsiderContext = await browser.newContext();

  try {
    await signUp(page, memberEmail, password);
    await page.goto("/dashboard/organization");
    await page.getByLabel("Organization name").fill(teamName);
    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(page.getByRole("heading", { name: teamName })).toBeVisible({ timeout: 15_000 });

    await signUp(await outsiderContext.newPage(), outsiderEmail, password);

    const { organizationId, memberId, outsiderId } = await withDb(async (db) => ({
      organizationId: await organizationIdOf(db, memberEmail),
      memberId: await userIdOf(db, memberEmail),
      outsiderId: await userIdOf(db, outsiderEmail),
    }));
    const topic = organizationChangesTopic(organizationId);

    // The same topic, two signed-in people: the member's join is the control
    // that makes the refusal a decision about membership, not a broken socket.
    await expect(subscribeStatus(topic, realtimeTokenFor(memberId))).resolves.toBe(
      REALTIME_SUBSCRIBE_STATES.SUBSCRIBED,
    );
    await expect(subscribeStatus(topic, realtimeTokenFor(outsiderId))).resolves.toBe(
      REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
    );
  } finally {
    await outsiderContext.close();
    await deleteAccounts([memberEmail, outsiderEmail]);
  }
});
