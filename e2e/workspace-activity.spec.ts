import { expect, type Locator, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

import { formatDay } from "@/lib/shared/format-date";
import { routes } from "@/lib/shared/routes";

/**
 * A workspace records what happened to it, and its own page reads that history
 * newest first. A change made through the interface and a change made through a
 * capability write the same record, so the page is the same history either way.
 * It is authorized exactly like the workspace, and it reads one page at a time.
 */

async function signUp(
  page: Page,
  { name, email, password }: { name: string; email: string; password: string },
) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

async function findUserId(db: Client, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>('select id from "user" where email = $1', [
    email,
  ]);
  if (!rows[0]) throw new Error(`No user row for ${email}`);
  return rows[0].id;
}

async function findWorkspaceId(db: Client, creatorId: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'select id from workspace where "creatorId" = $1 order by "createdAt" desc limit 1',
    [creatorId],
  );
  if (!rows[0]) throw new Error("The workspace was not created");
  return rows[0].id;
}

/**
 * Dialogs ignore clicks until the client bundle hydrates, so retry the trigger
 * instead of relying on a fixed wait.
 */
async function openDialog(page: Page, trigger: Locator, role: "dialog" | "alertdialog" = "dialog") {
  await expect(async () => {
    await trigger.click();
    await expect(page.getByRole(role)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

test("a workspace's history records who changed what and pages back through it", async ({
  page,
  browser,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-activity-${id}@example.com`;
  const password = `e2e-pass-${id}`;
  const otherEmail = `e2e-activity-other-${id}@example.com`;
  const otherPassword = `e2e-pass-other-${id}`;
  const workspaceName = `History ${id}`;
  const renamedWorkspace = `History renamed ${id}`;

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  let userId: string | null = null;
  let workspaceId: string | null = null;
  const cleanups: Array<() => Promise<void>> = [];

  try {
    await signUp(page, { name: "Activity Tester", email, password });
    userId = await findUserId(db, email);

    await test.step("creating and changing a workspace writes its history", async () => {
      await openDialog(page, page.getByRole("button", { name: "Create new workspace" }).first());
      const createDialog = page.getByRole("dialog");
      await createDialog.getByLabel("Workspace name").fill(workspaceName);
      await createDialog.getByRole("button", { name: "Save" }).click();
      await expect(createDialog).toHaveCount(0);

      workspaceId = await findWorkspaceId(db, userId as string);

      const card = page.getByRole("listitem").filter({ hasText: workspaceName }).first();
      await openDialog(page, card.getByRole("button", { name: "Edit" }));

      const editDialog = page.getByRole("dialog");
      await editDialog.getByLabel("Workspace name").fill(renamedWorkspace);
      await editDialog.getByLabel("Stage").click();
      await page.getByRole("option", { name: "In progress" }).click();
      await editDialog.getByRole("button", { name: "Save" }).click();
      await expect(editDialog).toHaveCount(0);
    });

    await test.step("the workspace opens its history newest first, grouped by day", async () => {
      if (!workspaceId) throw new Error("The workspace id is missing");

      await page.goto(routes.workspace(workspaceId));
      await page.getByRole("link", { name: "View activity" }).click();
      await page.waitForURL(`**${routes.workspaceActivity(workspaceId)}`);

      await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
      await expect(page.getByRole("link", { name: `← Back to ${renamedWorkspace}` })).toBeVisible();

      const today = formatDay(new Date());
      if (!today) throw new Error("Today has no label");
      await expect(page.getByRole("heading", { name: today })).toBeVisible();

      const entries = page.getByRole("main").getByRole("listitem");
      await expect(entries.filter({ hasText: "Moved from Planning to In progress" })).toBeVisible();
      await expect(entries.filter({ hasText: `Renamed from ${workspaceName}` })).toBeVisible();
      await expect(entries.filter({ hasText: "Created the workspace" })).toBeVisible();

      // Newest first: the save that moved the workspace is the newest activity,
      // the rename it wrote alongside comes next, then the creation. Rows from
      // one save share an instant, so their order comes from the log itself.
      await expect(entries.nth(0)).toContainText("Moved from Planning to In progress");
      await expect(entries.nth(1)).toContainText(`Renamed from ${workspaceName}`);
      await expect(entries.nth(2)).toContainText("Created the workspace");

      // The actor is the person who made the change.
      await expect(entries.nth(0)).toContainText("Workspace · Activity Tester ·");
    });

    await test.step("a second person is refused exactly as they are for the workspace", async () => {
      if (!workspaceId) throw new Error("The workspace id is missing");

      const context = await browser.newContext();
      cleanups.push(() => context.close());
      const other = await context.newPage();
      await signUp(other, { name: "Other Tester", email: otherEmail, password: otherPassword });

      await other.goto(routes.workspaceActivity(workspaceId));
      await expect(other.getByRole("heading", { name: "This page is off the map" })).toBeVisible();
      await expect(other.getByText(renamedWorkspace)).toHaveCount(0);
    });

    await test.step("older activity is loaded one page at a time", async () => {
      if (!workspaceId || !userId) throw new Error("The workspace or user id is missing");

      // Twenty-five older rows so the first page cannot hold the history: the
      // oldest day must only appear after "load older".
      for (let index = 0; index < 25; index += 1) {
        await db.query(
          `insert into "workspaceActivity"
             (id, "workspaceId", surface, kind, "actorType", "actorUserId", details, "createdAt")
           values ($1, $2, 'WORKSPACE', 'ARCHIVED', 'PERSON', $3, '{}'::jsonb, $4)`,
          [
            `${workspaceId}_seed_${index}`,
            workspaceId,
            userId,
            new Date(Date.UTC(2025, 0, 1 + index, 12, 0, 0)),
          ],
        );
      }

      await page.reload();

      await expect(page.getByRole("heading", { name: "Jan 1, 2025" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Jan 25, 2025" })).toBeVisible();

      await page.getByRole("link", { name: "Load older activity" }).click();

      await expect(page.getByRole("heading", { name: "Jan 1, 2025" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Load older activity" })).toHaveCount(0);
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
      .query('delete from "user" where email = any($1)', [[email, otherEmail]])
      .catch(() => undefined);
    await db.end();
  }
});
