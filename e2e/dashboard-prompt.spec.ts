import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

/**
 * The dashboard opens with a prompt composer for the agent. It is the first
 * thing a signed-in person sees, so its keyboard contract matters: Enter sends,
 * Shift+Enter keeps a line break, and the example prompts populate the field.
 * Sending has no agent run behind it yet, so the composer keeps the draft.
 */

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Prompt Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

test("the dashboard prompt composer sends on Enter and keeps Shift+Enter for new lines", async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);

  await signUp(page, `e2e-prompt-${id}@example.com`, `e2e-pass-${id}`);

  const composer = page.getByRole("textbox", { name: "Prompt" });
  const send = page.getByRole("button", { name: "Send prompt" });

  await expect(
    page.getByRole("heading", { name: "What are we planning today?" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Describe it, and the agent drafts the doc and the canvas for you.",
    ),
  ).toBeVisible();
  await expect(composer).toBeVisible();
  await expect(page.getByText("Shift + Enter for a new line")).toBeVisible();
  await expect(send).toBeDisabled();

  await composer.fill("Plan the schema");
  await composer.press("Shift+Enter");
  await composer.pressSequentially("and the API");

  await expect(composer).toHaveValue("Plan the schema\nand the API");
  await expect(send).toBeEnabled();

  // Enter submits instead of adding another line. The run flow is not wired
  // yet, so the draft stays in place.
  await composer.press("Enter");
  await expect(composer).toHaveValue("Plan the schema\nand the API");

  await composer.fill("   ");
  await expect(send).toBeDisabled();

  await page
    .getByRole("button", { name: "Map out a user onboarding flow" })
    .click();
  await expect(composer).toHaveValue("Map out a user onboarding flow");
  await expect(composer).toBeFocused();
  await expect(send).toBeEnabled();
});
