import { type Browser, expect, type Locator, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

import { routes } from "@/lib/shared/routes";

/**
 * Workspaces are managed from the dashboard and reached through /workspaces/:id.
 * Access is decided by the workspace's own account, not by whichever account the
 * dashboard is showing, so a second person must get a 404 for a personal workspace
 * even though both are signed in. Archiving is a soft delete: it frees a plan
 * slot and can be undone.
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

async function findWorkspaceId(
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

async function findOrganizationId(db: Client, userId: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `select o.id
       from organization o
       join member m on m.organization_id = o.id
      where m.user_id = $1
      order by o.created_at desc
      limit 1`,
    [userId],
  );
  if (!rows[0]) throw new Error("The organization was not created");
  return rows[0].id;
}

/**
 * Dialogs ignore clicks until the client bundle hydrates, so retry the trigger
 * instead of relying on a fixed wait. Once the dialog is open the assertion
 * succeeds and the callback stops.
 */
async function openDialog(page: Page, trigger: Locator, role: "dialog" | "alertdialog" = "dialog") {
  await expect(async () => {
    await trigger.click();
    await expect(page.getByRole(role)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/**
 * A card's actions live in its overflow menu, so opening one means opening the
 * menu first. Hydration makes the trigger ignore a click for a moment, hence
 * the retry.
 */
async function chooseCardAction(
  page: Page,
  card: Locator,
  action: "Edit" | "Archive" | "Restore" | "Delete",
) {
  await expect(async () => {
    await card.getByRole("button", { name: /^Actions for / }).click();
    await expect(page.getByRole("menuitem", { name: action, exact: true })).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 30_000 });

  await page.getByRole("menuitem", { name: action, exact: true }).click();
}

async function createWorkspace(
  page: Page,
  { name, description, verify = true }: { name: string; description?: string; verify?: boolean },
) {
  await openDialog(page, page.getByRole("button", { name: "Create new workspace" }).first());

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill(name);
  if (description) await dialog.getByLabel("Description").fill(description);
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toHaveCount(0);
  if (verify) await expect(page.getByText(name).first()).toBeVisible();
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
  const email = `e2e-workspaces-${id}@example.com`;
  const password = `e2e-pass-${id}`;
  const otherEmail = `e2e-workspaces-other-${id}@example.com`;
  const otherPassword = `e2e-pass-other-${id}`;
  const workspaceName = `Roadmap ${id}`;
  const renamedWorkspace = `Roadmap renamed ${id}`;

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  let userId: string | null = null;
  let workspaceId: string | null = null;
  const cleanups: Array<() => Promise<void>> = [];

  try {
    await test.step("a new account has no workspaces and can create one", async () => {
      await signUp(page, { name: "Workspace Tester", email, password });

      await expect(page.getByText("No workspaces in Personal account")).toBeVisible();
      await expect(page.getByText("0 / 3")).toBeVisible();

      // The board is the four-column frame even while the account is empty; the
      // empty state sits inside it rather than replacing it.
      await page.goto(routes.workspaces);
      for (const stage of ["Planning", "In progress", "In review", "Done"]) {
        await expect(page.getByRole("heading", { name: stage, exact: true })).toBeVisible();
      }
      await expect(page.getByText("No workspaces in Personal account")).toBeVisible();
      await page.goto(routes.dashboard);

      await createWorkspace(page, {
        name: workspaceName,
        description: "Where the quarter goes",
      });

      await expect(page.getByRole("heading", { name: "Latest in Personal account" })).toBeVisible();
      await expect(page.getByText("Where the quarter goes")).toBeVisible();
      await expect(page.getByText("1 / 3")).toBeVisible();

      userId = await findUserId(db, email);
      workspaceId = await findWorkspaceId(db, { name: workspaceName, creatorId: userId });

      // Create is not stage-aware: a new workspace lands in the first stage.
      await page.goto(routes.workspaces);
      await expect(
        page.getByRole("region", { name: "Planning" }).getByRole("link", { name: workspaceName }),
      ).toBeVisible();
      await page.goto(routes.dashboard);
    });

    await test.step("the workspace route opens only for someone with access", async () => {
      if (!workspaceId) throw new Error("The workspace id is missing");

      await page.getByRole("link", { name: workspaceName }).click();
      await page.waitForURL(`**${routes.workspace(workspaceId)}`);

      await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();
      await expect(page.getByText("The workspace editor is on its way")).toBeVisible();
      // The shell around it is the page's main landmark; nesting another fails
      // the landmark audit.
      await expect(page.getByRole("main")).toHaveCount(1);
      // The detail page is a surface of the workspaces section, not a standalone page.
      await expect(page.getByRole("link", { name: "All workspaces" })).toBeVisible();

      const other = await signUpInNewContext(browser, {
        email: otherEmail,
        password: otherPassword,
      });
      cleanups.push(other.close);

      await other.page.goto(routes.workspace(workspaceId));
      await expect(
        other.page.getByRole("heading", { name: "This page is off the map" }),
      ).toBeVisible();
      await expect(other.page.getByText(workspaceName)).toHaveCount(0);
    });

    await test.step("renaming and restaging the workspace persists", async () => {
      await page.goto("/dashboard");

      const card = page.getByRole("listitem").filter({ hasText: workspaceName }).first();
      await chooseCardAction(page, card, "Edit");

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Edit workspace")).toBeVisible();
      await dialog.getByLabel("Workspace name").fill(renamedWorkspace);
      await dialog.getByLabel("Stage").click();
      await page.getByRole("option", { name: "In progress" }).click();
      await dialog.getByRole("button", { name: "Save" }).click();

      await expect(dialog).toHaveCount(0);
      await expect(page.getByText(renamedWorkspace).first()).toBeVisible();
      await expect(page.getByText("In progress").first()).toBeVisible();
    });

    await test.step("the board shows one column per stage, in stage order", async () => {
      if (!userId) throw new Error("The test user is missing");
      const archivedWorkspace = `Archived ${id}`;
      const foreignWorkspace = `Elsewhere ${id}`;
      const otherUserId = await findUserId(db, otherEmail);

      // Both rows are reachable by the same select if the board's predicate is
      // wrong: one belongs to the account but is archived, the other belongs to
      // a different personal account.
      await db.query(
        'insert into workspace (id, name, "creatorId", status, position, "archivedAt") values ($1, $2, $3, $4, $5, $6)',
        [randomUUID(), archivedWorkspace, userId, "PLANNING", 0, new Date()],
      );
      await db.query(
        'insert into workspace (id, name, "creatorId", status, position) values ($1, $2, $3, $4, $5)',
        [randomUUID(), foreignWorkspace, otherUserId, "DONE", 0],
      );

      await page.goto(routes.workspaces);

      for (const stage of ["Planning", "In progress", "In review", "Done"]) {
        await expect(page.getByRole("heading", { name: stage, exact: true })).toBeVisible();
      }

      // The workspace sits in the column its stage names, and an empty stage
      // still renders its column.
      await expect(
        page
          .getByRole("region", { name: "In progress" })
          .getByRole("listitem")
          .filter({ hasText: renamedWorkspace }),
      ).toHaveCount(1);
      await expect(
        page.getByRole("region", { name: "Done" }).getByText("Nothing in this stage yet."),
      ).toBeVisible();

      // Each column states how many cards it holds.
      await expect(
        page.getByRole("region", { name: "In progress" }).getByText("1", { exact: true }),
      ).toBeVisible();

      // The card carries its creator and when the work last moved, both read
      // with the board's bounded queries.
      const inProgress = page.getByRole("region", { name: "In progress" });
      await expect(inProgress.getByText("Workspace Tester", { exact: true })).toBeVisible();
      await expect(
        inProgress.getByText(/^Last activity (just now|\d+ minutes? ago)$/),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Done" }).getByText("0", { exact: true }),
      ).toBeVisible();

      // An archived workspace and another account's workspace are in the same
      // table but not in this board.
      await expect(page.getByText(archivedWorkspace)).toHaveCount(0);
      await expect(page.getByText(foreignWorkspace)).toHaveCount(0);

      // The fixtures exist only for this assertion; the archive page later in
      // this test expects to be otherwise empty.
      await db.query("delete from workspace where name = any($1)", [
        [archivedWorkspace, foreignWorkspace],
      ]);

      await page.goto(routes.dashboard);
    });

    await test.step("archiving hides the workspace and frees its plan slot", async () => {
      const card = page.getByRole("listitem").filter({ hasText: renamedWorkspace }).first();
      await chooseCardAction(page, card, "Archive");

      const dialog = page.getByRole("alertdialog");
      await expect(dialog.getByText(`Archive ${renamedWorkspace}?`)).toBeVisible();
      await dialog.getByRole("button", { name: "Archive workspace" }).click();

      await expect(page.getByText("No workspaces in Personal account")).toBeVisible();
      await expect(page.getByText("0 / 3")).toBeVisible();
      await expect(page.getByText("Archived workspaces")).toBeVisible();
      await expect(page.getByRole("listitem").filter({ hasText: renamedWorkspace })).toHaveCount(1);
    });

    await test.step("the archive page restores a workspace", async () => {
      await page.goto("/dashboard/archive");
      await expect(page.getByRole("heading", { name: "Archived workspaces" })).toBeVisible();

      const archived = page.getByRole("listitem").filter({ hasText: renamedWorkspace }).first();
      await chooseCardAction(page, archived, "Restore");

      await expect(page.getByText("Nothing archived in Personal account")).toBeVisible();
      await expect(page.getByRole("listitem").filter({ hasText: renamedWorkspace })).toHaveCount(0);

      await page.goto("/dashboard");
      await expect(page.getByText("Archived workspaces")).toHaveCount(0);
      await expect(page.getByText(renamedWorkspace).first()).toBeVisible();
      await expect(page.getByText("1 / 3")).toBeVisible();
    });

    await test.step("the dashboard lists workspaces, docs and canvases together", async () => {
      if (!workspaceId) throw new Error("The workspace id is missing");

      await db.query('insert into doc (id, "workspaceId") values ($1, $2)', [
        randomUUID(),
        workspaceId,
      ]);
      await db.query('insert into canvas (id, "workspaceId") values ($1, $2)', [
        randomUUID(),
        workspaceId,
      ]);

      await page.reload();

      await expect(page.getByText(/Doc · updated/)).toBeVisible();
      await expect(page.getByText(/Canvas · updated/)).toBeVisible();
      await expect(
        page.getByRole("list", { name: "Latest items" }).getByRole("listitem"),
      ).toHaveCount(3);
    });

    await test.step("the Free plan blocks a fourth workspace", async () => {
      await createWorkspace(page, { name: `Second ${id}` });
      await createWorkspace(page, { name: `Third ${id}` });

      await expect(page.getByText("3 / 3")).toBeVisible();

      await openDialog(page, page.getByRole("button", { name: "Create new workspace" }).first());

      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Workspace name").fill(`Fourth ${id}`);
      await dialog.getByRole("button", { name: "Save" }).click();

      await expect(dialog.getByText(/has used all 3 workspaces on the Free plan/)).toBeVisible();
      await expect(dialog.getByRole("link", { name: "View plans" })).toBeVisible();

      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByText(`Fourth ${id}`)).toHaveCount(0);
    });

    await test.step("an archived workspace can be deleted permanently", async () => {
      if (!workspaceId) throw new Error("The workspace id is missing");

      // The dashboard's latest list is capped and now holds this workspace's
      // doc and canvas, so the workspace card is managed from /workspaces.
      await page.goto("/workspaces");
      const card = page.getByRole("listitem").filter({ hasText: renamedWorkspace }).first();
      await chooseCardAction(page, card, "Archive");
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Archive workspace" })
        .click();
      await expect(card).toHaveCount(0);

      await expect
        .poll(
          async () => {
            const { rows } = await db.query<{ archivedAt: Date | null }>(
              'select "archivedAt" from workspace where id = $1',
              [workspaceId],
            );
            return rows[0]?.archivedAt instanceof Date;
          },
          { message: "the archive action commits before the page is opened" },
        )
        .toBe(true);

      // Only an archived card offers Delete, and it sits behind its overflow menu.
      await page.goto("/dashboard/archive");
      await expect(page.getByText("2 / 3")).toBeVisible();
      const archivedCards = page.getByRole("listitem").filter({ hasText: renamedWorkspace });
      await expect(archivedCards).toHaveCount(1);
      await chooseCardAction(page, archivedCards.first(), "Delete");

      const dialog = page.getByRole("alertdialog");
      await expect(dialog.getByText(`Delete ${renamedWorkspace} permanently?`)).toBeVisible();
      await dialog.getByRole("button", { name: "Delete workspace" }).click();

      // The archive page empties with its last row, and the row is gone from the
      // database rather than merely hidden.
      await expect(page.getByText("Nothing archived in Personal account")).toBeVisible();
      const { rows } = await db.query("select id from workspace where id = $1", [workspaceId]);
      expect(rows).toHaveLength(0);
    });
  } finally {
    for (const cleanup of cleanups) {
      await cleanup().catch(() => undefined);
    }

    await db
      .query(
        'delete from workspace where "creatorId" in (select id from "user" where email = any($1))',
        [[email, otherEmail]],
      )
      .catch(() => undefined);
    await db
      .query('delete from "user" where email = any($1)', [[email, otherEmail]])
      .catch(() => undefined);
    await db.end();
  }
});

test("a workspace is archived, restored and deleted from its own page", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-workspace-page-${id}@example.com`;
  const password = `e2e-pass-${id}`;
  const workspaceName = `Detail page ${id}`;

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  let userId: string | null = null;

  try {
    await signUp(page, { name: "Detail Tester", email, password });
    userId = await findUserId(db, email);
    const creatorId = userId;
    await createWorkspace(page, { name: workspaceName });

    await page.getByRole("link", { name: workspaceName }).click();
    await page.waitForURL("**/workspaces/**");

    await test.step("archiving from the workspace page shows the archived state", async () => {
      await openDialog(
        page,
        page.getByRole("button", { name: "Archive", exact: true }),
        "alertdialog",
      );
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Archive workspace" })
        .click();

      // The sidebar's "Archived" link also matches the bare text, so the badge
      // is read inside the page's main region.
      await expect(page.getByRole("main").getByText("Archived", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Restore" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
    });

    await test.step("restoring brings the workspace back to the dashboard", async () => {
      await page.getByRole("button", { name: "Restore" }).click();

      await expect(page.getByRole("main").getByText("Archived", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Archive", exact: true })).toBeVisible();
      // Deleting is only ever offered once the workspace is archived.
      await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);

      await page.goto("/dashboard");
      await expect(page.getByText(workspaceName).first()).toBeVisible();
    });

    await test.step("deleting the archived workspace removes it for good", async () => {
      await page.getByRole("link", { name: workspaceName }).click();
      await page.waitForURL("**/workspaces/**");

      await openDialog(
        page,
        page.getByRole("button", { name: "Archive", exact: true }),
        "alertdialog",
      );
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Archive workspace" })
        .click();
      await expect(page.getByRole("main").getByText("Archived", { exact: true })).toBeVisible();

      await openDialog(
        page,
        page.getByRole("button", { name: "Delete", exact: true }),
        "alertdialog",
      );

      const dialog = page.getByRole("alertdialog");
      await expect(dialog.getByText(`Delete ${workspaceName} permanently?`)).toBeVisible();
      await dialog.getByRole("button", { name: "Delete workspace" }).click();

      // The page it was showing no longer exists, and the row is gone from the
      // database rather than merely hidden.
      await expect(page.getByRole("heading", { name: "This page is off the map" })).toBeVisible();
      const { rows } = await db.query<{ id: string }>(
        'select id from workspace where name = $1 and "creatorId" = $2',
        [workspaceName, creatorId],
      );
      expect(rows).toHaveLength(0);
    });
  } finally {
    if (userId) {
      await db
        .query('delete from workspace where "creatorId" = $1', [userId])
        .catch(() => undefined);
    }
    await db.query('delete from "user" where email = $1', [email]).catch(() => undefined);
    await db.end();
  }
});

test("an organization workspace records the creating member and opens from /workspaces", async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-org-workspaces-${id}@example.com`;
  const password = `e2e-pass-${id}`;
  const teamName = `Workspaces Team ${id}`;
  const workspaceName = `Team roadmap ${id}`;

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  let userId: string | null = null;
  let organizationId: string | null = null;

  try {
    await signUp(page, { name: "Org Workspace Tester", email, password });
    userId = await findUserId(db, email);

    await page.goto("/dashboard/organization");
    await page.getByLabel("Organization name").fill(teamName);
    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(page.getByRole("heading", { name: teamName })).toBeVisible({ timeout: 15_000 });

    organizationId = await findOrganizationId(db, userId);

    await page.goto("/dashboard");
    // The team's fresh dashboard is empty; the helper's visibility check would
    // race the revalidation, so the row is asserted below instead.
    await createWorkspace(page, { name: workspaceName, verify: false });

    const { rows } = await db.query<{
      creatorId: string;
      orgId: string | null;
    }>('select "creatorId", "orgId" from workspace where name = $1', [workspaceName]);

    expect(rows[0]).toEqual({ creatorId: userId, orgId: organizationId });

    await page.goto("/workspaces");
    await expect(page.getByRole("heading", { name: "All workspaces" })).toBeVisible();
    await expect(page.getByText(workspaceName).first()).toBeVisible();
  } finally {
    if (userId) {
      await db
        .query('delete from workspace where "creatorId" = $1', [userId])
        .catch(() => undefined);
    }
    if (organizationId) {
      await db
        .query("delete from organization where id = $1", [organizationId])
        .catch(() => undefined);
    }
    await db.query('delete from "user" where email = $1', [email]).catch(() => undefined);
    await db.end();
  }
});
