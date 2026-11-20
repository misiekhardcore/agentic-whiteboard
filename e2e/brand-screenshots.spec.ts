import { expect, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

/**
 * The install prompt shows real product screenshots, so they are captured from
 * the running app instead of being drawn. Opt-in because it needs a signed-in
 * account, a database and a writable `public/brand/screenshots` directory:
 * `pnpm test:e2e:brand`.
 */
test.skip(
  !process.env.BRAND_SCREENSHOTS,
  "Set BRAND_SCREENSHOTS=1 (pnpm test:e2e:brand) to capture the manifest screenshots.",
);

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("WorkspAIce Screenshot");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

async function createWorkspace(page: Page, name: string, description: string) {
  await page.getByRole("button", { name: "Create new workspace" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill(name);
  await dialog.getByLabel("Description").fill(description);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(name).first()).toBeVisible();
}

test("captures the dashboard for the web manifest", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  await signUp(page, `brand-${id}@example.com`, `brand-pass-${id}`);

  await createWorkspace(
    page,
    "Checkout flow map",
    "Where the cart, payment and confirmation edges meet.",
  );
  await createWorkspace(
    page,
    "Q4 launch plan",
    "Owners, milestones and the open questions for the next release.",
  );

  // The dev indicator is a Next portal, not part of the product; hide it so the
  // install prompt does not show a development badge.
  const hideDevOverlay = () =>
    page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await hideDevOverlay();
  await page.screenshot({ path: "public/brand/screenshots/dashboard-wide.png" });

  await page.setViewportSize({ width: 720, height: 1280 });
  await page.goto("/dashboard");
  await hideDevOverlay();
  await page.screenshot({ path: "public/brand/screenshots/dashboard-narrow.png" });
});
