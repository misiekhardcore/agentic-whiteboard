import { expect, type Locator, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

import { routes } from "@/lib/shared/routes";

/**
 * The board moves work by dragging a card. The browser names the stage and the
 * cards it lands between; the server derives the position, so the spec proves
 * persistence by reloading rather than by reading a number back.
 */

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Board Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

async function createWorkspace(page: Page, name: string) {
  await expect(async () => {
    await page.getByRole("button", { name: "Create new workspace" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(name).first()).toBeVisible();
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

async function archivedAt(name: string): Promise<Date | null> {
  return withDb(async (db) => {
    const { rows } = await db.query<{ archivedAt: Date | null }>(
      'select "archivedAt" from workspace where name = $1',
      [name],
    );
    return rows[0]?.archivedAt ?? null;
  });
}

async function stageOf(name: string): Promise<string | null> {
  return withDb(async (db) => {
    const { rows } = await db.query<{ status: string }>(
      "select status from workspace where name = $1",
      [name],
    );
    return rows[0]?.status ?? null;
  });
}

async function orderIn(stage: string, names: string[]): Promise<string[]> {
  return withDb(async (db) => {
    const { rows } = await db.query<{ name: string }>(
      "select name from workspace where status = $1 and name = any($2) order by position, id",
      [stage, names],
    );
    return rows.map((row) => row.name);
  });
}

function column(page: Page, stage: string) {
  return page.getByRole("region", { name: stage, exact: true });
}

async function linkNames(columnLocator: Locator): Promise<string[]> {
  return columnLocator.getByRole("listitem").getByRole("link").allTextContents();
}

/**
 * A real pointer drag: press the card's handle, cross the activation distance,
 * then move to the target and drop. The target point is configurable so a card
 * can be approached from its right edge instead of its link.
 */
async function drag(
  page: Page,
  handle: Locator,
  target: Locator,
  targetPoint: { x: number; y: number } = { x: 0.5, y: 0.5 },
) {
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("The drag source or target is not visible.");

  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const end = { x: to.x + to.width * targetPoint.x, y: to.y + to.height * targetPoint.y };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 12, start.y + 12, { steps: 5 });
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

test("a card is dragged between stages and reordered, and the board remembers it", async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-board-${id}@example.com`;
  const password = `e2e-pass-${id}`;
  const alpha = `Alpha ${id}`;
  const beta = `Beta ${id}`;
  const gamma = `Gamma ${id}`;
  const names = [alpha, beta, gamma];

  try {
    await signUp(page, email, password);

    // The Free plan allows three workspaces; each starts in Planning.
    await createWorkspace(page, alpha);
    await createWorkspace(page, beta);
    await createWorkspace(page, gamma);

    await page.goto(routes.workspaces);
    await expect(page.getByRole("button", { name: `Move ${alpha}` })).toBeVisible();

    await test.step("a card dragged to another stage lands there and persists", async () => {
      await expect(async () => {
        await drag(
          page,
          page.getByRole("button", { name: `Move ${alpha}` }),
          column(page, "In progress"),
        );
        await expect(column(page, "In progress").getByRole("link", { name: alpha })).toBeVisible({
          timeout: 2_000,
        });
      }).toPass({ timeout: 30_000 });

      await expect.poll(() => stageOf(alpha)).toBe("IN_PROGRESS");

      await page.reload();
      await expect(column(page, "In progress").getByRole("link", { name: alpha })).toBeVisible();
      await expect(column(page, "Planning").getByRole("link", { name: alpha })).toHaveCount(0);
    });

    await test.step("a card dropped between two cards keeps that place after a reload", async () => {
      // Beta is dropped on Alpha's card: it lands before it.
      await expect(async () => {
        await drag(
          page,
          page.getByRole("button", { name: `Move ${beta}` }),
          column(page, "In progress").getByRole("listitem").filter({ hasText: alpha }),
          { x: 0.85, y: 0.5 },
        );
        await expect.poll(() => linkNames(column(page, "In progress"))).toEqual([beta, alpha]);
      }).toPass({ timeout: 30_000 });

      await expect.poll(() => orderIn("IN_PROGRESS", names)).toEqual([beta, alpha]);

      await page.reload();
      expect(await linkNames(column(page, "In progress"))).toEqual([beta, alpha]);
    });

    await test.step("a card dragged within its column changes the order", async () => {
      // Alpha is dragged back above Beta in the same column.
      await expect(async () => {
        await drag(
          page,
          page.getByRole("button", { name: `Move ${alpha}` }),
          column(page, "In progress").getByRole("listitem").filter({ hasText: beta }),
          { x: 0.85, y: 0.5 },
        );
        await expect.poll(() => linkNames(column(page, "In progress"))).toEqual([alpha, beta]);
      }).toPass({ timeout: 30_000 });

      await expect.poll(() => orderIn("IN_PROGRESS", names)).toEqual([alpha, beta]);

      await page.reload();
      expect(await linkNames(column(page, "In progress"))).toEqual([alpha, beta]);
    });

    await test.step("the keyboard moves a card and a screen reader announces it", async () => {
      const handle = page.getByRole("button", { name: `Move ${gamma}` });
      const liveRegion = page.locator('[id^="DndLiveRegion"]');

      // The handle only listens after hydration, so retry the sequence until the
      // live region confirms the card was picked up.
      await expect(async () => {
        await page.keyboard.press("Escape");
        await handle.focus();
        await page.keyboard.press("Space");
        await expect(handle).toHaveAttribute("aria-pressed", "true", { timeout: 2_000 });

        await page.keyboard.press("ArrowRight");
        await expect(liveRegion).toContainText("is over In progress.", { timeout: 2_000 });

        await page.keyboard.press("Space");
        await expect(liveRegion).toContainText(`Moved ${gamma} to In progress.`, {
          timeout: 2_000,
        });
      }).toPass({ timeout: 30_000 });

      await expect.poll(() => stageOf(gamma)).toBe("IN_PROGRESS");

      await page.reload();
      await expect(column(page, "In progress").getByRole("link", { name: gamma })).toBeVisible();
    });
  } finally {
    await withDb(async (db) => {
      await db
        .query(
          'delete from workspace where "creatorId" = (select id from "user" where email = $1)',
          [email],
        )
        .catch(() => undefined);
      await db.query('delete from "user" where email = $1', [email]).catch(() => undefined);
    });
  }
});

test("a drop refused because the card was archived elsewhere is rolled back and explained", async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-board-refusal-${id}@example.com`;
  const password = `e2e-pass-${id}`;
  const name = `Stale ${id}`;

  try {
    await signUp(page, email, password);
    await createWorkspace(page, name);

    await page.goto(routes.workspaces);
    await expect(page.getByRole("button", { name: `Move ${name}` })).toBeVisible();

    // Another open board archives the card while this tab keeps its stale copy,
    // so the next drop is refused by the server rather than never attempted.
    await withDb(async (db) => {
      await db.query('update workspace set "archivedAt" = now() where name = $1', [name]);
    });

    await expect(column(page, "Planning").getByRole("link", { name })).toBeVisible();

    await drag(page, page.getByRole("button", { name: `Move ${name}` }), column(page, "Done"));

    // The refusal is explained in words a person can act on, and the stale card
    // is put back where it was instead of staying optimistically in Done.
    await expect(
      page.getByText("This workspace is archived. Restore it before moving it."),
    ).toBeVisible();
    await expect(column(page, "Done").getByRole("link", { name })).toHaveCount(0);
    await expect(column(page, "Planning").getByRole("link", { name })).toBeVisible();

    // A refusal is not a write: the row the other tab archived is untouched.
    expect(await archivedAt(name)).not.toBeNull();

    await test.step("a card deleted elsewhere is refused with a refresh hint", async () => {
      await withDb(async (db) => {
        await db.query("delete from workspace where name = $1", [name]);
      });

      await drag(page, page.getByRole("button", { name: `Move ${name}` }), column(page, "Done"));

      await expect(
        page.getByText("That workspace could not be found. Refresh the board and try again."),
      ).toBeVisible();
      await expect(column(page, "Done").getByRole("link", { name })).toHaveCount(0);
      await expect(column(page, "Planning").getByRole("link", { name })).toBeVisible();
    });
  } finally {
    await withDb(async (db) => {
      await db
        .query(
          'delete from workspace where "creatorId" = (select id from "user" where email = $1)',
          [email],
        )
        .catch(() => undefined);
      await db.query('delete from "user" where email = $1', [email]).catch(() => undefined);
    });
  }
});
