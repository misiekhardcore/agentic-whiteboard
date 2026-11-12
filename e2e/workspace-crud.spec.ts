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
 * Workspaces are managed from the dashboard and reached through /workspace/:id.
 * Access is decided by the workspace's own account, not by whichever account the
 * dashboard is showing, so a second person must get a 404 for a personal workspace
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

async function findOrganizationId(
  db: Client,
  userId: string,
): Promise<string> {
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

async function createWorkspace(
  page: Page,
  {
    name,
    description,
    verify = true,
  }: { name: string; description?: string; verify?: boolean },
) {
  await openDialog(
    page,
    page.getByRole("button", { name: "Create new workspace" }).first(),
  );

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

      await createWorkspace(page, {
        name: workspaceName,
        description: "Where the quarter goes",
      });

      await expect(
        page.getByRole("heading", { name: "Latest in Personal account" }),
      ).toBeVisible();
      await expect(page.getByText("Where the quarter goes")).toBeVisible();
      await expect(page.getByText("1 / 3")).toBeVisible();

      userId = await findUserId(db, email);
      workspaceId = await findWorkspaceId(db, { name: workspaceName, creatorId: userId });
    });

    await test.step("the workspace route opens only for someone with access", async () => {
      await page.getByRole("link", { name: workspaceName }).click();
      await page.waitForURL(`**/workspace/${workspaceId}`);

      await expect(
        page.getByRole("heading", { name: workspaceName }),
      ).toBeVisible();
      await expect(page.getByText("The workspace editor is on its way")).toBeVisible();

      const other = await signUpInNewContext(browser, {
        email: otherEmail,
        password: otherPassword,
      });
      cleanups.push(other.close);

      await other.page.goto(`/workspace/${workspaceId}`);
      await expect(
        other.page.getByText("This page could not be found."),
      ).toBeVisible();
      await expect(other.page.getByText(workspaceName)).toHaveCount(0);
    });

    await test.step("renaming and restaging the workspace persists", async () => {
      await page.goto("/dashboard");

      const card = page
        .getByRole("listitem")
        .filter({ hasText: workspaceName })
        .first();
      await openDialog(page, card.getByRole("button", { name: "Edit" }));

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

    await test.step("archiving hides the workspace and frees its plan slot", async () => {
      const card = page
        .getByRole("listitem")
        .filter({ hasText: renamedWorkspace })
        .first();
      await openDialog(
        page,
        card.getByRole("button", { name: "Archive", exact: true }),
        "alertdialog",
      );

      const dialog = page.getByRole("alertdialog");
      await expect(dialog.getByText(`Archive ${renamedWorkspace}?`)).toBeVisible();
      await dialog.getByRole("button", { name: "Archive workspace" }).click();

      await expect(page.getByText("No workspaces in Personal account")).toBeVisible();
      await expect(page.getByText("0 / 3")).toBeVisible();
      await expect(page.getByText("Archived workspaces")).toBeVisible();
      await expect(
        page.getByRole("listitem").filter({ hasText: renamedWorkspace }),
      ).toHaveCount(1);
    });

    await test.step("a restored workspace comes back with its stage", async () => {
      const archived = page
        .getByRole("listitem")
        .filter({ hasText: renamedWorkspace })
        .first();
      await archived.getByRole("button", { name: "Restore" }).click();

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
      await db.query(
        'insert into canvas (id, "workspaceId") values ($1, $2)',
        [randomUUID(), workspaceId],
      );

      await page.reload();

      await expect(page.getByText(/Doc · updated/)).toBeVisible();
      await expect(page.getByText(/Canvas · updated/)).toBeVisible();
      await expect(
        page
          .getByRole("list", { name: "Latest items" })
          .getByRole("listitem"),
      ).toHaveCount(3);
    });

    await test.step("the Free plan blocks a fourth workspace", async () => {
      await createWorkspace(page, { name: `Second ${id}` });
      await createWorkspace(page, { name: `Third ${id}` });

      await expect(page.getByText("3 / 3")).toBeVisible();

      await openDialog(
        page,
        page.getByRole("button", { name: "Create new workspace" }).first(),
      );

      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Workspace name").fill(`Fourth ${id}`);
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
    await expect(
      page.getByRole("heading", { name: teamName }),
    ).toBeVisible({ timeout: 15_000 });

    organizationId = await findOrganizationId(db, userId);

    await page.goto("/dashboard");
    // The team's fresh dashboard is empty; the helper's visibility check would
    // race the revalidation, so the row is asserted below instead.
    await createWorkspace(page, { name: workspaceName, verify: false });

    const { rows } = await db.query<{
      creatorId: string;
      orgId: string | null;
    }>('select "creatorId", "orgId" from workspace where name = $1', [
      workspaceName,
    ]);

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
    await db
      .query('delete from "user" where email = $1', [email])
      .catch(() => undefined);
    await db.end();
  }
});
