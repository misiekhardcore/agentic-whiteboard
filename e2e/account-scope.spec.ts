import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

/**
 * The account switcher is the source of truth for the dashboard, team page and
 * billing. Workspace rows are seeded directly because these tests only care
 * about scoping, not about the creation flow (covered by workspace-crud).
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

/**
 * Radix tabs and buttons ignore clicks until the client bundle hydrates, so
 * retry the interaction instead of relying on a fixed wait.
 */
async function openTeamPlanSheet(page: Page) {
  await expect(async () => {
    await page.getByRole("tab", { name: "Team" }).click();
    await expect(
      page.getByRole("tab", { name: "Team" }),
    ).toHaveAttribute("aria-selected", "true", { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });

  await expect(async () => {
    await page.getByRole("button", { name: /choose team/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 30_000 });
}

async function findUserId(db: Client, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'select id from "user" where email = $1',
    [email],
  );
  if (!rows[0]) throw new Error(`No user row for ${email}`);
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

async function insertBoard(
  db: Client,
  board: {
    id: string;
    name: string;
    userId: string;
    organizationId: string | null;
  },
) {
  await db.query(
    'insert into workspace (id, name, "creatorId", "orgId") values ($1, $2, $3, $4)',
    [board.id, board.name, board.userId, board.organizationId],
  );
}

test("personal and organization accounts stay separate", async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-account-${id}@example.com`;
  const password = `e2e-pass-${id}`;
  const userName = "Scope Tester";
  const teamName = `Orbit Scope ${id}`;
  const personalBoard = `Personal board ${id}`;
  const organizationBoard = `Organization board ${id}`;
  const personalBoardId = randomUUID();
  const organizationBoardId = randomUUID();

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  let userId: string | null = null;
  let organizationId: string | null = null;

  try {
    await test.step("the personal account is the default", async () => {
      await signUp(page, { name: userName, email, password });

      await expect(page.getByText("Personal account.")).toBeVisible();
      await expect(
        page.getByText("No boards in Personal account"),
      ).toBeVisible();
    });

    await test.step("personal boards appear only in the personal account", async () => {
      userId = await findUserId(db, email);
      await insertBoard(db, {
        id: personalBoardId,
        name: personalBoard,
        userId,
        organizationId: null,
      });

      await page.reload();

      await expect(
        page.getByRole("heading", { name: "Personal account boards" }),
      ).toBeVisible();
      await expect(page.getByText(personalBoard)).toBeVisible();
    });

    await test.step("creating an organization activates it and scopes its boards", async () => {
      await page.goto("/dashboard/organization");
      await page.getByLabel("Organization name").fill(teamName);
      await page
        .getByRole("button", { name: "Create organization" })
        .click();

      // Wait for the server action to finish before reading the new row.
      await expect(page.getByText(teamName).first()).toBeVisible({
        timeout: 15_000,
      });

      if (!userId) throw new Error("The test user is missing");
      organizationId = await findOrganizationId(db, userId);
      await insertBoard(db, {
        id: organizationBoardId,
        name: organizationBoard,
        userId,
        organizationId,
      });

      await page.goto("/dashboard");

      await expect(
        page.getByText(`Working in ${teamName}.`),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: `${teamName} boards` }),
      ).toBeVisible();
      await expect(page.getByText(organizationBoard)).toBeVisible();
      await expect(page.getByText(personalBoard)).toHaveCount(0);
    });

    await test.step("the organization page has no selector; the account menu switches", async () => {
      await page.goto("/dashboard/organization");
      await expect(
        page.getByRole("heading", { name: teamName }),
      ).toBeVisible();
      await expect(page.getByLabel("Active account")).toHaveCount(0);

      await page
        .getByRole("button", { name: /Account menu for/ })
        .click();
      await page
        .getByRole("button", { name: /Personal account/ })
        .click();

      await expect(page.getByText("Your organizations")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Manage" }),
      ).toBeVisible();

      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { name: "Personal account boards" }),
      ).toBeVisible();
      await expect(page.getByText(personalBoard)).toBeVisible();
      await expect(page.getByText(organizationBoard)).toHaveCount(0);
    });

    await test.step("team checkout requires an explicit organization on personal", async () => {
      await page.goto("/#pricing");
      await openTeamPlanSheet(page);

      const sheet = page.getByRole("dialog");
      await expect(sheet.getByLabel("Organization")).toContainText(
        "Choose an organization",
      );
      await sheet
        .getByRole("button", { name: /continue to secure checkout/i })
        .click();
      await expect(
        sheet.getByText("Choose an organization to continue."),
      ).toBeVisible();

      // The API must not silently fall back to the first organization either.
      const refused = await page.request.post("/api/billing/checkout", {
        data: { planId: "team", seats: 1 },
      });
      expect(refused.status()).toBe(400);
      await expect(refused.json()).resolves.toMatchObject({
        error: "Choose an organization before starting a team plan.",
      });

      await page.keyboard.press("Escape");
    });

    await test.step("opening the organization defaults team checkout to it", async () => {
      await page.goto("/dashboard/organization");
      await expect(page.getByText("Your organizations")).toBeVisible();
      await page
        .getByRole("button", { name: /Account menu for/ })
        .click();
      await page
        .getByRole("button", { name: new RegExp(teamName) })
        .click();
      await expect(
        page.getByRole("heading", { name: teamName }),
      ).toBeVisible();

      // The organization's plan lives on the billing page, which now owns it
      // rather than the members page.
      await page.goto("/dashboard/billing");
      await expect(
        page.getByText("Plan", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(`Plan, usage and invoices for ${teamName}`),
      ).toBeVisible();

      await page.goto("/#pricing");
      await openTeamPlanSheet(page);

      const sheet = page.getByRole("dialog");
      await expect(sheet.getByLabel("Organization")).toContainText(
        teamName,
      );
      await expect(sheet.getByLabel("Seats")).toHaveValue("1");

      await page.keyboard.press("Escape");
    });
  } finally {
    // Clean up the rows this test created, even when an assertion failed.
    await db
      .query("delete from workspace where id = any($1)", [
        [personalBoardId, organizationBoardId],
      ])
      .catch(() => undefined);

    if (organizationId) {
      await db
        .query("delete from organization where id = $1", [
          organizationId,
        ])
        .catch(() => undefined);
    }

    await db
      .query(
        `delete from organization
          where id in (
            select organization_id
              from member
             where user_id = (select id from "user" where email = $1)
          )`,
        [email],
      )
      .catch(() => undefined);

    await db
      .query('delete from "user" where email = $1', [email])
      .catch(() => undefined);

    await db.end();
  }
});
