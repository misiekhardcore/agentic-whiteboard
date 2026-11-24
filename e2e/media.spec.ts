import { type APIResponse, expect, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * Media is stored once and read through the app. These specs drive the real
 * routes against a stand-in bucket: a person uploads an image from their board,
 * opens it back, and removes it; someone outside the file's account cannot open
 * it even with the id. What the bucket stores is the adapter's contract, which
 * the real stack exercised when it was built.
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

async function createWorkspace(page: Page, name: string) {
  await expect(async () => {
    await page.getByRole("button", { name: "Create new workspace" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toHaveCount(0);
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

async function findUserId(db: Client, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>('select id from "user" where email = $1', [
    email,
  ]);
  if (!rows[0]) throw new Error(`No user row for ${email}`);
  return rows[0].id;
}

/** A one-pixel PNG, so the upload passes the image whitelist. */
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function upload(page: Page, workspaceId: string): Promise<APIResponse> {
  return page.request.post("/api/media", {
    multipart: {
      workspaceId,
      file: { name: "pixel.png", mimeType: "image/png", buffer: png },
    },
  });
}

test("a person uploads an image, opens it back, and removes it", async ({ page }) => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const email = `media-${randomUUID()}@example.com`;
  const workspaceName = `Media ${randomUUID()}`;

  try {
    await signUp(page, { name: "Media Person", email, password: "password-1234" });
    await createWorkspace(page, workspaceName);

    const creatorId = await findUserId(db, email);
    const workspaceId = await findWorkspaceId(db, { name: workspaceName, creatorId });

    const created = await upload(page, workspaceId);
    expect(created.status()).toBe(201);

    const { id, url } = (await created.json()) as { id: string; url: string };
    expect(url).toBe(`/api/media/${id}`);

    const { rows } = await db.query<{ orgId: string | null }>(
      'select "orgId" from media where id = $1',
      [id],
    );
    expect(rows[0]?.orgId).toBeNull();

    const opened = await page.request.get(url);
    expect(opened.status()).toBe(200);
    expect(opened.headers()["content-type"]).toBe("image/png");
    expect(Buffer.from(await opened.body()).equals(png)).toBe(true);

    const removed = await page.request.delete(url);
    expect(removed.status()).toBe(204);

    expect((await page.request.get(url)).status()).toBe(404);
  } finally {
    await db.end();
  }
});

test("a file is refused to someone outside its account, and to an archive", async ({
  page,
  browser,
}) => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const email = `media-owner-${randomUUID()}@example.com`;
  const workspaceName = `Media ${randomUUID()}`;

  try {
    await signUp(page, { name: "Media Owner", email, password: "password-1234" });
    await createWorkspace(page, workspaceName);

    const creatorId = await findUserId(db, email);
    const workspaceId = await findWorkspaceId(db, { name: workspaceName, creatorId });

    const created = await upload(page, workspaceId);
    expect(created.status()).toBe(201);
    const { url } = (await created.json()) as { url: string };

    const outsider = await browser.newContext();
    const outsiderPage = await outsider.newPage();
    await signUp(outsiderPage, {
      name: "Media Outsider",
      email: `media-outsider-${randomUUID()}@example.com`,
      password: "password-1234",
    });

    expect((await outsiderPage.request.get(url)).status()).toBe(404);
    expect((await outsiderPage.request.delete(url)).status()).toBe(404);
    await outsider.close();

    // Archiving is a soft delete that makes the workspace read-only, so a new
    // upload against it is refused at the workspace check.
    await db.query('update workspace set "archivedAt" = now() where id = $1', [workspaceId]);
    expect((await upload(page, workspaceId)).status()).toBe(403);
  } finally {
    await db.end();
  }
});
