import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

/**
 * The dashboard opens with a prompt composer for the agent: Enter sends,
 * Shift+Enter keeps a line break, and sending runs a real request through
 * `/api/agent/prompts`. Playwright starts the app with `AI_PROVIDER=stub`, so
 * the scripted provider answers deterministically and can call the
 * createWorkspace tool.
 */

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Prompt Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

async function deleteAccount(email: string) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    // Workspaces have no foreign key on their creator, and the agent creates
    // one in these tests, so remove them before the user row cascades prompts.
    await db
      .query(
        `delete from workspace
          where "creatorId" = (select id from "user" where email = $1)`,
        [email],
      )
      .catch(() => undefined);
    await db
      .query('delete from "user" where email = $1', [email])
      .catch(() => undefined);
  } finally {
    await db.end();
  }
}

test("the composer sends on Enter, keeps Shift+Enter for new lines and streams a reply", async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-prompt-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

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

    // Enter sends instead of adding another line.
    await composer.press("Enter");

    const thread = page.getByRole("list", { name: "Agent conversation" });
    await expect(thread).toContainText("Plan the schema");
    await expect(thread).toContainText("and the API");
    await expect(thread).toContainText("Stub agent: Plan the schema");
    // The reply is markdown: the prefix is emphasis, not a literal `**`.
    await expect(thread.locator("strong").first()).toHaveText("Stub agent:");
    await expect(thread).not.toContainText("**");
    await expect(composer).toHaveValue("");

    // The thread is stored, so a reload replays it from the database.
    await page.reload();
    await expect(
      page.getByRole("list", { name: "Agent conversation" }),
    ).toContainText("Stub agent: Plan the schema");
    await expect(composer).toHaveValue("");

    await composer.fill("   ");
    await expect(send).toBeDisabled();

    await page
      .getByRole("button", { name: "Map out a user onboarding flow" })
      .click();
    await expect(composer).toHaveValue("Map out a user onboarding flow");
    await expect(composer).toBeFocused();
    await expect(send).toBeEnabled();
  } finally {
    await deleteAccount(email);
  }
});

test("the agent can create a workspace from a dashboard prompt", async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-workspace-tool-${id}@example.com`;
  const workspaceName = `E2E Workspace ${id}`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    await composer.fill(`Create a workspace called "${workspaceName}"`);
    await composer.press("Enter");

    const thread = page.getByRole("list", { name: "Agent conversation" });
    await expect(thread).toContainText("The workspace is ready.");
    await expect(thread.locator("ul > li")).toHaveText(
      "It is listed under the latest workspaces below.",
    );

    // The tool call is listed in the conversation, named and with what it acted
    // on, rather than hidden behind the reply that followed it.
    const toolCall = thread.getByRole("button", { name: /Create workspace/ });
    await expect(toolCall).toContainText(workspaceName);

    await toolCall.click();
    await expect(thread).toContainText(`"name": "${workspaceName}"`);
    await expect(thread).toContainText("\"created\": true");

    // `onFinish` refreshes the server components, so the new workspace joins
    // the account's latest list without a reload.
    await expect(
      page.getByRole("heading", { name: "Latest in Personal account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: workspaceName }),
    ).toBeVisible();

    // The tool call was stored with the reply, so a reload still lists it.
    await page.reload();
    await expect(
      page
        .getByRole("list", { name: "Agent conversation" })
        .getByRole("button", { name: /Create workspace/ }),
    ).toContainText(workspaceName);
  } finally {
    await deleteAccount(email);
  }
});
