import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

/**
 * The meter and upgrade UI depend on where usage lives: workspaces belong to
 * the account, prompts belong to the member inside it. The test seeds both,
 * including prompts for a second member, so the header must still show the
 * signed-in user's own count.
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

test("usage meters reflect the active account and the upgrade dialog offers plans", async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-upgrade-${id}@example.com`;
  const password = `e2e-pass-${id}`;
  const userName = "Upgrade Tester";
  const teamName = `Upgrade Team ${id}`;
  const secondMemberEmail = `e2e-upgrade-member-${id}@example.com`;

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  let organizationId: string | null = null;
  let secondUserId: string | null = null;

  try {
    await test.step("a new personal account starts at zero with no upgrade CTA", async () => {
      await signUp(page, { name: userName, email, password });

      await expect(page.getByText("0 / 20")).toBeVisible();
      await expect(page.getByText("0 / 3")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Upgrade plan" }),
      ).toHaveCount(0);
    });

    await test.step("seed an organization, its workspaces and per-member prompts", async () => {
      const ownerId = await findUserId(db, email);
      organizationId = randomUUID();
      secondUserId = randomUUID();
      const memberIds = [randomUUID(), randomUUID()];

      await db.query(
        'insert into organization (id, name, slug, created_at) values ($1, $2, $3, now())',
        [organizationId, teamName, `upgrade-team-${id}`],
      );
      await db.query(
        'insert into member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, $4, now())',
        [memberIds[0], organizationId, ownerId, "owner"],
      );
      await db.query(
        'insert into "user" (id, name, email) values ($1, $2, $3)',
        [secondUserId, "Second Member", secondMemberEmail],
      );
      await db.query(
        'insert into member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, $4, now())',
        [memberIds[1], organizationId, secondUserId, "member"],
      );

      const workspaceIds = [randomUUID(), randomUUID(), randomUUID()];
      for (const [index, workspaceId] of workspaceIds.entries()) {
        await db.query(
          'insert into workspace (id, name, "creatorId", "orgId") values ($1, $2, $3, $4)',
          [workspaceId, `Team workspace ${index + 1}`, ownerId, organizationId],
        );
      }

      // The owner has spent their own 20; the second member has spent 5. The
      // header must count the owner only, never the organization total.
      for (let index = 0; index < 20; index += 1) {
        await db.query(
          'insert into "AgentPrompt" (id, "ownerId", "userId", "workspaceId") values ($1, $2, $3, $4)',
          [
            randomUUID(),
            organizationId,
            ownerId,
            workspaceIds[index % workspaceIds.length],
          ],
        );
      }
      for (let index = 0; index < 5; index += 1) {
        await db.query(
          'insert into "AgentPrompt" (id, "ownerId", "userId", "workspaceId") values ($1, $2, $3, $4)',
          [randomUUID(), organizationId, secondUserId, workspaceIds[0]],
        );
      }
    });

    await test.step("the organization's own plan and usage appear after switching", async () => {
      await page.reload();

      await page
        .getByRole("button", { name: `Account menu for ${userName}` })
        .click();
      await page.getByRole("button", { name: new RegExp(teamName) }).click();

      await expect(page.getByText("20 / 20")).toBeVisible();
      await expect(page.getByText("3 / 3")).toBeVisible();
      await expect(page.getByText("Team workspace 1")).toBeVisible();
    });

    await test.step("the upgrade dialog explains both limits and offers the team plans", async () => {
      // The header and the sidebar footer both offer the upgrade once a limit
      // is reached, and both open the same dialog.
      const upgradeButtons = page.getByRole("button", { name: "Upgrade plan" });
      await expect(upgradeButtons).toHaveCount(2);

      await upgradeButtons.first().click();

      const dialog = page.getByRole("dialog", { name: "Upgrade your plan" });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText(/used 20 of 20 prompts this month in/),
      ).toBeVisible();
      await expect(
        dialog.getByText(/has used all 3 workspaces on the Free plan/),
      ).toBeVisible();

      // The organization pays, so a personal plan is not an answer here.
      await expect(dialog.getByRole("tab", { name: "Personal" })).toHaveCount(0);
      await expect(
        dialog.getByRole("button", { name: "Upgrade to Team" }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Upgrade to Enterprise" }),
      ).toBeVisible();
      await expect(
        dialog.getByText(/500 agent prompts per member \/ month/),
      ).toBeVisible();
    });

    await test.step("choosing a plan opens checkout on top of the closed dialog", async () => {
      await page.getByRole("button", { name: "Upgrade to Team" }).click();

      const checkout = page.getByRole("dialog", { name: "Choose Team" });
      await expect(checkout).toBeVisible();
      await expect(
        checkout.getByRole("button", { name: "Continue to secure checkout" }),
      ).toBeVisible();

      await checkout.getByRole("button", { name: "Close" }).click();
      await expect(page.getByText("20 / 20")).toBeVisible();
    });

    await test.step("the sidebar's upgrade CTA opens the same dialog", async () => {
      // The footer sits at the bottom of a fixed sidebar, so it has to stay
      // inside the viewport rather than being pushed past the bottom edge.
      const sidebarCta = page
        .getByRole("button", { name: "Upgrade plan" })
        .last();
      await expect(sidebarCta).toBeInViewport();
      await expect(page.getByText("3 / 3")).toBeInViewport();

      await sidebarCta.click();

      const dialog = page.getByRole("dialog", { name: "Upgrade your plan" });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText(/has used all 3 workspaces on the Free plan/),
      ).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    });

    await test.step("the personal account stayed at zero throughout", async () => {
      await page.goto("/dashboard/settings");
      await page
        .getByRole("button", { name: /Account menu for/ })
        .click();
      await page
        .getByRole("button", { name: /Personal account/ })
        .click();

      await expect(page.getByText("0 / 20")).toBeVisible();
      await expect(page.getByText("0 / 3")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Upgrade plan" }),
      ).toHaveCount(0);
    });
  } finally {
    if (organizationId) {
      await db.query('delete from "AgentPrompt" where "ownerId" = $1', [
        organizationId,
      ]);
      await db.query('delete from workspace where "orgId" = $1', [
        organizationId,
      ]);
      await db.query("delete from organization where id = $1", [
        organizationId,
      ]);
    }
    if (secondUserId) {
      await db.query('delete from "user" where id = $1', [secondUserId]);
    }
    await db.end();
  }
});
