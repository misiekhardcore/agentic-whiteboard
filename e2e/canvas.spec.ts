import { expect, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

import { routes } from "@/lib/shared/routes";

/**
 * The canvas is the workspace's place. These specs drive the real engine
 * against the real sync service: a person draws, reloads and finds the drawing;
 * a second browser sees the same board change without reloading; an archived
 * workspace's board cannot be written; and a canvas service that cannot be
 * reached reads as unavailable rather than as a broken app.
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

async function signIn(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
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

/** The board's canvas surface, which only exists once the engine has mounted. */
function board(page: Page) {
  return page.getByTestId("workspace-canvas").locator(".tl-canvas").first();
}

async function shapes(page: Page) {
  return page.locator(".tl-shape").count();
}

/**
 * Pick the rectangle tool from the board's toolbar, then drag one onto the
 * canvas. The toolbar button is the path a person takes; the keyboard shortcut
 * depends on the editor having focus, which is not settled while it mounts.
 */
async function drawRectangle(page: Page) {
  const canvas = board(page);
  await expect(canvas).toBeVisible();

  await page.getByTestId("tools.rectangle").click();

  const box = await canvas.boundingBox();
  if (!box) throw new Error("The canvas has no size");

  const startX = box.x + 60;
  const startY = box.y + 60;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 180, startY + 120, { steps: 8 });
  await page.mouse.up();

  // Back to the select tool, so the next gesture starts from a clean mode.
  await page.getByTestId("tools.select").click();
}

async function drawUntilOneShape(page: Page) {
  await expect(async () => {
    if ((await shapes(page)) === 0) await drawRectangle(page);
    await expect(page.locator(".tl-shape")).toHaveCount(1, { timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
}

async function waitForSavedRevision(db: Client, workspaceId: string, above: number) {
  await expect
    .poll(
      async () => {
        const { rows } = await db.query<{ revision: number }>(
          'select revision from canvas where "workspaceId" = $1',
          [workspaceId],
        );
        return rows[0]?.revision ?? 0;
      },
      { message: "the room writes its snapshot to the canvas row", timeout: 30_000 },
    )
    .toBeGreaterThan(above);
}

test("a drawing is saved and seen live, and an archived canvas is read-only", async ({
  page,
  browser,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-canvas-${id}@example.com`;
  const password = `e2e-pass-${id}`;
  const workspaceName = `Canvas ${id}`;

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  let workspaceId: string | null = null;

  try {
    await test.step("a new workspace opens on a canvas", async () => {
      await signUp(page, { name: "Canvas Tester", email, password });
      await createWorkspace(page, workspaceName);

      const userId = await findUserId(db, email);
      workspaceId = await findWorkspaceId(db, { name: workspaceName, creatorId: userId });

      // The canvas row and the workspace are one write, so it exists already.
      const { rows } = await db.query('select revision from canvas where "workspaceId" = $1', [
        workspaceId,
      ]);
      expect(rows).toHaveLength(1);

      await page.goto(routes.workspace(workspaceId));
      await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();
      await expect(board(page)).toBeVisible();
    });

    await test.step("a drawn shape survives a reload", async () => {
      if (!workspaceId) throw new Error("The workspace id is missing");

      await drawUntilOneShape(page);
      await waitForSavedRevision(db, workspaceId, 0);

      await page.reload();

      await expect(page.locator(".tl-shape")).toHaveCount(1, { timeout: 30_000 });
    });

    await test.step("a second browser sees an edit without reloading", async () => {
      if (!workspaceId) throw new Error("The workspace id is missing");

      const context = await browser.newContext();
      const teammate = await context.newPage();
      await signIn(teammate, { email, password });
      await teammate.goto(routes.workspace(workspaceId));

      await expect(teammate.locator(".tl-shape")).toHaveCount(1, { timeout: 30_000 });

      // The first browser draws again; the second must see it on the open board.
      await expect(async () => {
        await drawRectangle(page);
        await expect(teammate.locator(".tl-shape")).toHaveCount(2, { timeout: 5_000 });
      }).toPass({ timeout: 45_000 });

      await context.close();
    });

    await test.step("a canvas service that cannot be reached reads as unavailable", async () => {
      if (!workspaceId) throw new Error("The workspace id is missing");

      await page.route("**/api/canvas/*/token", (route) => route.abort());
      await page.reload();

      await expect(page.getByText("The canvas is unavailable right now")).toBeVisible();
      // The workspace itself is untouched by the canvas being down.
      await expect(page.getByText("Manage this workspace")).toBeVisible();
      await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();

      await page.unroute("**/api/canvas/*/token");
    });

    await test.step("an archived workspace's canvas is read-only", async () => {
      if (!workspaceId) throw new Error("The workspace id is missing");

      await page.reload();
      await expect(board(page)).toBeVisible();
      await expect(page.locator(".tl-shape")).toHaveCount(2, { timeout: 30_000 });

      await page.getByRole("button", { name: "Archive", exact: true }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Archive workspace" })
        .click();

      await expect(page.getByText(/canvas is read-only while archived/)).toBeVisible();
      await expect(board(page)).toBeVisible();

      // The room's answer, not the page's archive flag, is what makes the board
      // read-only: the archived session is closed and its reconnection is
      // minted read-only, which removes the drawing tools from the toolbar.
      await expect(page.getByTestId("tools.rectangle")).toHaveCount(0, { timeout: 30_000 });

      // That reconnection built a new room from the stored row, so the drawing
      // coming back is the snapshot being restored rather than the first room
      // still holding it in memory.
      await expect(page.locator(".tl-shape")).toHaveCount(2, { timeout: 30_000 });

      // A drawing gesture on a read-only board changes nothing.
      const before = await shapes(page);
      const box = await board(page).boundingBox();
      if (!box) throw new Error("The canvas has no size");
      await page.mouse.move(box.x + 60, box.y + 60);
      await page.mouse.down();
      await page.mouse.move(box.x + 240, box.y + 180, { steps: 8 });
      await page.mouse.up();
      // A read-only editor creates nothing from the gesture, so the count is
      // settled as soon as the pointer is released.
      expect(await shapes(page)).toBe(before);

      // Restoring closes the read-only session the same way, so the open board
      // becomes writable again without a reload.
      await page.getByRole("button", { name: "Restore", exact: true }).click();
      await expect(page.getByTestId("tools.rectangle")).toHaveCount(1, { timeout: 30_000 });
      await expect(page.locator(".tl-shape")).toHaveCount(before);
    });
  } finally {
    await db
      .query(
        'delete from workspace where "creatorId" in (select id from "user" where email = $1)',
        [email],
      )
      .catch(() => undefined);
    await db.query('delete from "user" where email = $1', [email]).catch(() => undefined);
    await db.end();
  }
});
