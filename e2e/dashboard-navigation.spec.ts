import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * The dashboard is the signed-in home surface, so the sidebar names it like
 * every other one. Its entry matches the path exactly: the other dashboard
 * targets all start with `/dashboard`, so a prefix match would light it up on
 * every one of them.
 */
test("the sidebar links the dashboard from the other signed-in surfaces", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-dashboard-nav-${id}@example.com`;
  const password = `e2e-pass-${id}`;

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  try {
    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Dashboard Nav Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/dashboard");

    // Exact: the "Back to dashboard" links on other pages also match the name.
    const dashboardLink = page.getByRole("link", { name: "Dashboard", exact: true });

    await test.step("the dashboard is the current surface on /dashboard", async () => {
      await expect(dashboardLink).toBeVisible();
      await expect(dashboardLink).toHaveAttribute("data-active", "true");
    });

    await test.step("another dashboard page does not claim the dashboard entry", async () => {
      await page.goto("/dashboard/archive");

      await expect(page.getByRole("link", { name: "Archived" })).toHaveAttribute(
        "data-active",
        "true",
      );
      await expect(dashboardLink).not.toHaveAttribute("data-active", "true");
    });

    await test.step("the sidebar returns to the dashboard", async () => {
      await dashboardLink.click();
      await page.waitForURL("**/dashboard");
      await expect(dashboardLink).toHaveAttribute("data-active", "true");
    });

    await test.step("the entry is there from the workspace surfaces too", async () => {
      await page.goto("/workspaces");
      await dashboardLink.click();
      await page.waitForURL("**/dashboard");
    });
  } finally {
    await db.query('delete from "user" where email = $1', [email]).catch(() => undefined);
    await db.end();
  }
});
