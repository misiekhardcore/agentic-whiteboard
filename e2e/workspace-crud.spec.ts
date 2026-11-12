import { randomUUID } from "node:crypto";

import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import { Client } from "pg";

/**
 * Boards are managed from the dashboard and reached through /workspace/:id.
 * Access is decided by the board's own account, not by whichever account the
 * dashboard is showing, so a second person must get a 404 for a personal board
 * even though both are signed in. Archiving is a soft delete: it frees a plan
 * slot and can be undone.
 */

async function signUp(
  page: Page,
  {
    name,
    email,
    password,
  }: { name: string; email: string; password: string },
) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

async function findUserId(db: Client, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'select id from "user" where email = $1',
    [email],
  );
  if (!rows[0]) throw new Error(`No user row for ${email}`);
  return rows[0].id;
}

async function findBoardId(
  db: Client,
  { name, creatorId }: { name: string; creatorId: string },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'select id from workspace where name = $1 and "creatorId" = $2',
    [name, creatorId],
  );
  if (!rows[0]) throw new Error(`No workspace row for ${name}`);
  return rows[0].id;
}

/**
 * Dialogs ignore clicks until the client bundle hydrates, so retry the trigger
 * instead of relying on a fixed wait. Once the dialog is open the assertion
 * succeeds and the callback stops.
 */
async function openDialog(
  page: Page,
  trigger: Locator,
  role: "dialog" | "alertdialog" = "dialog",
) {
  await expect(async () => {
    await trigger.click();
    await expect(page.getByRole(role)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

async function createBoard(
  page: Page,
  { name, description }: { name: string; description?: string },
) {
  await openDialog(
    page,
    page.getByRole("button", { name: "Create new board" }).first(),
  );

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Board name").fill(name);
  if (description) await dialog.getByLabel("Description").fill(description);
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(name).first()).toBeVisible();
}

async function signUpInNewContext(
  browser: Browser,
  {
    email,
    password,
  }: {
    email: string;
    password: string;
  },
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUp(page, { name: "Other Tester", email, password });
  return { page, close: () => context.close() };
}

test("workspace CRUD is scoped to the account and archives reversibly", async ({
  page,
  browser,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-boards-${id}@example.com`;
  const password = `e2e-pass-${id}`;
  const otherEmail = `e2e-boards-other-${id}@example.com`;
  const otherPassword = `e2e-pass-other-${id}`;
  const boardName = `Roadmap ${id}`;
  const renamedBoard = `Roadmap renamed ${id}`;

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  let userId: string | null = null;
  let boardId: string | null = null;
  const cleanups: Array<() => Promise<void>> = [];

  try {
    await test.step("a new account has no boards and can create one", async () => {
      await signUp(page, { name: "Board Tester", email, password });

      await expect(page.getByText("No boards in Personal account")).toBeVisible();
      await expect(page.getByText("0 / 3")).toBeVisible();

      await createBoard(page, {
        name: boardName,
        description: "Where the quarter goes",
      });

      await expect(
        page.getByRole("heading", { name: "Personal account boards" }),
      ).toBeVisible();
      await expect(page.getByText("Where the quarter goes")).toBeVisible();
      await expect(page.getByText("1 / 3")).toBeVisible();

      userId = await findUserId(db, email);
      boardId = await findBoardId(db, { name: boardName, creatorId: userId });
    });

    await test.step("the board route opens only for someone with access", async () => {
      await page.getByRole("link", { name: boardName }).click();
      await page.waitForURL(`**/workspace/${boardId}`);

      await expect(
        page.getByRole("heading", { name: boardName }),
      ).toBeVisible();
      await expect(page.getByText("The board editor is on its way")).toBeVisible();

      const other = await signUpInNewContext(browser, {
        email: otherEmail,
        password: otherPassword,
      });
      cleanups.push(other.close);

      await other.page.goto(`/workspace/${boardId}`);
      await expect(
        other.page.getByText("This page could not be found."),
      ).toBeVisible();
      await expect(other.page.getByText(boardName)).toHaveCount(0);
    });

    await test.step("renaming and restaging the board persists", async () => {
      await page.goto("/dashboard");

      const card = page
        .getByRole("listitem")
        .filter({ hasText: boardName })
        .first();
      await openDialog(page, card.getByRole("button", { name: "Edit" }));

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Edit board")).toBeVisible();
      await dialog.getByLabel("Board name").fill(renamedBoard);
      await dialog.getByLabel("Stage").click();
      await page.getByRole("option", { name: "In progress" }).click();
      await dialog.getByRole("button", { name: "Save" }).click();

      await expect(dialog).toHaveCount(0);
      await expect(page.getByText(renamedBoard).first()).toBeVisible();
      await expect(page.getByText("In progress").first()).toBeVisible();
    });

    await test.step("archiving hides the board and frees its plan slot", async () => {
      const card = page
        .getByRole("listitem")
        .filter({ hasText: renamedBoard })
        .first();
      await openDialog(
        page,
        card.getByRole("button", { name: "Archive", exact: true }),
        "alertdialog",
      );

      const dialog = page.getByRole("alertdialog");
      await expect(dialog.getByText(`Archive ${renamedBoard}?`)).toBeVisible();
      await dialog.getByRole("button", { name: "Archive board" }).click();

      await expect(page.getByText("No boards in Personal account")).toBeVisible();
      await expect(page.getByText("0 / 3")).toBeVisible();
      await expect(page.getByText("Archived boards")).toBeVisible();
      await expect(
        page.getByRole("listitem").filter({ hasText: renamedBoard }),
      ).toHaveCount(1);
    });

    await test.step("a restored board comes back with its stage", async () => {
      const archived = page
        .getByRole("listitem")
        .filter({ hasText: renamedBoard })
        .first();
      await archived.getByRole("button", { name: "Restore" }).click();

      await expect(page.getByText("Archived boards")).toHaveCount(0);
      await expect(page.getByText(renamedBoard).first()).toBeVisible();
      await expect(page.getByText("1 / 3")).toBeVisible();
    });

    await test.step("the Free plan blocks a fourth board", async () => {
      await createBoard(page, { name: `Second ${id}` });
      await createBoard(page, { name: `Third ${id}` });

      await expect(page.getByText("3 / 3")).toBeVisible();

      await openDialog(
        page,
        page.getByRole("button", { name: "Create new board" }).first(),
      );

      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Board name").fill(`Fourth ${id}`);
      await dialog.getByRole("button", { name: "Save" }).click();

      await expect(
        dialog.getByText(/has used all 3 workspaces on the Free plan/),
      ).toBeVisible();
      await expect(
        dialog.getByRole("link", { name: "View plans" }),
      ).toBeVisible();

      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByText(`Fourth ${id}`)).toHaveCount(0);
    });
  } finally {
    for (const cleanup of cleanups) {
      await cleanup().catch(() => undefined);
    }

    if (userId) {
      await db
        .query('delete from workspace where "creatorId" = $1', [userId])
        .catch(() => undefined);
    }
    await db
      .query('delete from "user" where email = any($1)', [
        [email, otherEmail],
      ])
      .catch(() => undefined);
    await db.end();
  }
});
