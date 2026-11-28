import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { enterDemoWorkspace } from "./support";

function editor(page: Page) {
  return page.locator(".ProseMirror");
}

function revisionBadge(page: Page) {
  return page.getByTestId("doc-revision");
}

function numberOf(text: string, pattern: RegExp): number | null {
  const match = pattern.exec(text);
  return match === null ? null : Number(match[1]);
}

test("typing bumps the revision live and Ctrl+S saves it", async ({ page }) => {
  await enterDemoWorkspace(page);
  await page.goto("/w/ws_demo");
  await expect(page.locator(".doc-status")).toHaveText("Live", { timeout: 30_000 });

  const body = editor(page);
  await expect(body).toBeVisible();

  await expect(revisionBadge(page)).toContainText(/revision\s+\d+/);
  const initial = numberOf(await revisionBadge(page).innerText(), /revision\s+(\d+)/);
  if (initial === null) throw new Error("The revision badge showed no number.");

  // One quiet burst of typing is one revision, and the badge follows it over
  // the socket it already holds: no reload.
  await body.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("A revision bump");

  await expect
    .poll(async () => numberOf(await revisionBadge(page).innerText(), /revision\s+(\d+)/) ?? -1, {
      timeout: 15_000,
    })
    .toBeGreaterThan(initial);

  // Ctrl+S counts any pending burst immediately and stores the snapshot before
  // it answers, so the number it reports is the one the badge shows.
  await page.keyboard.press("Control+s");
  const saved = page.getByRole("status").filter({ hasText: "Saved · rev-" });
  await expect(saved).toBeVisible();

  const savedRevision = numberOf(await saved.innerText(), /rev-(\d+)/);
  if (savedRevision === null) throw new Error("The save reported no revision.");

  await expect(revisionBadge(page)).toContainText(`revision ${savedRevision}`);
});

test("a reload keeps the revision and the blocks it shows", async ({ page }) => {
  await enterDemoWorkspace(page);
  await page.goto("/w/ws_demo");
  await expect(page.locator(".doc-status")).toHaveText("Live", { timeout: 30_000 });
  await expect(editor(page)).toBeVisible();

  const before = await revisionBadge(page).innerText();
  const blocks = await editor(page).locator(":scope > *").count();

  // Loading the page must not write to the room: the editor waits for the
  // sync, so its empty starting paragraph never becomes a block or a revision.
  await page.reload();
  await expect(page.locator(".doc-status")).toHaveText("Live", { timeout: 30_000 });
  await expect(editor(page)).toBeVisible();

  await expect(revisionBadge(page)).toHaveText(before);
  expect(await editor(page).locator(":scope > *").count()).toBe(blocks);
});
