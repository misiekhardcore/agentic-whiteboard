import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

const WORKSPACE_PATH = "/w/ws_demo";
const BLOCK_TEXT = "Inserted from template";

function editor(page: Page) {
  return page.locator(".ProseMirror");
}

function insertedBlocks(page: Page) {
  return editor(page)
    .locator("p")
    .filter({ hasText: new RegExp(`^${BLOCK_TEXT}$`) });
}

async function openEditor(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(WORKSPACE_PATH);
  await expect(page.locator(".doc-status")).toHaveText("Live", { timeout: 30_000 });
  await expect(editor(page)).toBeVisible();

  return page;
}

async function countBlocks(page: Page): Promise<number> {
  return insertedBlocks(page).count();
}

/**
 * Both editors can still be applying the stored snapshot when the first
 * "Live" appears. Wait for three consecutive equal reads so the baseline is
 * the room's content, not whichever page happened to render first. The test
 * is relative to this count, so it can run against a database that already
 * holds blocks from an earlier run.
 */
async function waitForSyncedCount(first: Page, second: Page): Promise<number> {
  let previous = -1;
  let stableReads = 0;

  await expect
    .poll(
      async () => {
        const [firstCount, secondCount] = await Promise.all([
          countBlocks(first),
          countBlocks(second),
        ]);

        if (firstCount === secondCount && firstCount === previous) {
          stableReads += 1;
        } else {
          stableReads = 0;
        }

        previous = firstCount;
        return stableReads >= 2;
      },
      { timeout: 20_000, intervals: [250, 250, 500] },
    )
    .toBe(true);

  return previous;
}

test("a server insert lands once in every editor, replays, and survives reload", async ({
  browser,
}) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();

  try {
    const first = await openEditor(firstContext);
    const second = await openEditor(secondContext);
    const baseline = await waitForSyncedCount(first, second);

    const insert = first.getByTestId("insert-from-template");
    await expect(insert).toBeEnabled();

    await insert.click();
    const insertedStatus = first.getByRole("status").filter({ hasText: "Inserted a block" });
    await expect(insertedStatus).toBeVisible();
    await expect(insertedStatus).toContainText(/rev-\d+/);

    const revision = (await insertedStatus.textContent())?.match(/rev-\d+/)?.[0];
    if (revision === undefined) {
      throw new Error("The insert did not report a revision.");
    }

    await expect.poll(() => countBlocks(first)).toBe(baseline + 1);
    await expect.poll(() => countBlocks(second)).toBe(baseline + 1);

    await insert.click();
    const replayStatus = first.getByRole("status").filter({ hasText: "Already applied" });
    await expect(replayStatus).toBeVisible();
    await expect(replayStatus).toContainText(revision);

    await expect.poll(() => countBlocks(first)).toBe(baseline + 1);
    await expect.poll(() => countBlocks(second)).toBe(baseline + 1);

    await first.reload();
    await expect(first.locator(".doc-status")).toHaveText("Live", { timeout: 30_000 });
    await expect.poll(() => countBlocks(first)).toBe(baseline + 1);
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});
