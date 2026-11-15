import { expect, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
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
    await db.query('delete from "user" where email = $1', [email]).catch(() => undefined);
  } finally {
    await db.end();
  }
}

async function withDb<T>(work: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await work(db);
  } finally {
    await db.end();
  }
}

/** `undefined` means the row is gone; `null` means it exists and is active. */
async function workspaceArchivedAt(email: string, name: string): Promise<Date | null | undefined> {
  return withDb(async (db) => {
    const { rows } = await db.query(
      `select "archivedAt" from workspace
        where name = $1
          and "creatorId" = (select id from "user" where email = $2)`,
      [name, email],
    );

    return rows[0] ? (rows[0].archivedAt as Date | null) : undefined;
  });
}

async function promptCount(email: string): Promise<number> {
  return withDb(async (db) => {
    const { rows } = await db.query(
      `select count(*)::int as total from "agentPrompt"
        where "userId" = (select id from "user" where email = $1)`,
      [email],
    );

    return (rows[0]?.total as number | undefined) ?? 0;
  });
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

    await expect(page.getByRole("heading", { name: "What are we planning today?" })).toBeVisible();
    await expect(
      page.getByText("Describe it, and the agent drafts the doc and the canvas for you."),
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
    await expect(page.getByRole("list", { name: "Agent conversation" })).toContainText(
      "Stub agent: Plan the schema",
    );
    await expect(composer).toHaveValue("");

    await composer.fill("   ");
    await expect(send).toBeDisabled();

    await page.getByRole("button", { name: "Map out a user onboarding flow" }).click();
    await expect(composer).toHaveValue("Map out a user onboarding flow");
    await expect(composer).toBeFocused();
    await expect(send).toBeEnabled();
  } finally {
    await deleteAccount(email);
  }
});

test("a prompt sent while the agent is answering waits its turn", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-queue-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const thread = page.getByRole("list", { name: "Agent conversation" });
    const queue = page.getByRole("list", { name: "Queued prompts" });

    await composer.fill("First question");
    await composer.press("Enter");

    // The scripted provider holds its first chunk, so the agent is still busy
    // when the next two prompts arrive.
    await expect(page.getByRole("button", { name: "Stop prompt" })).toBeVisible();

    await composer.fill("Second question");
    await composer.press("Enter");
    await expect(queue).toContainText("Second question");
    await expect(composer).toHaveValue("");

    await composer.fill("Third question");
    await composer.press("Enter");
    await expect(queue).toContainText("Third question");

    // A queued prompt is not in the conversation yet: it has not been sent.
    await expect(thread).not.toContainText("Second question");

    // The person can take one back before it runs.
    await queue.getByRole("button", { name: "Remove queued prompt" }).last().click();
    await expect(queue).toContainText("Second question");
    await expect(queue).not.toContainText("Third question");

    // When the first reply ends, the waiting prompt is sent on its own.
    await expect(thread).toContainText("Stub agent: First question");
    await expect(thread).toContainText("Stub agent: Second question");
    await expect(thread).not.toContainText("Third question");
    await expect(queue).toHaveCount(0);
    await expect.poll(() => promptCount(email)).toBe(2);
  } finally {
    await deleteAccount(email);
  }
});

test("the agent can create a workspace from a dashboard prompt", async ({ page }) => {
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
    await expect(thread).toContainText('"ok": true');
    // The tool hands the agent the workspace's path, so a reply can link to it.
    await expect(thread).toContainText('"link": "/workspace/');

    // `onFinish` refreshes the server components, so the new workspace joins
    // the account's latest list without a reload.
    await expect(page.getByRole("heading", { name: "Latest in Personal account" })).toBeVisible();
    await expect(page.getByRole("link", { name: workspaceName })).toBeVisible();

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

test("the agent archives and deletes only after the person approves", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-approval-${id}@example.com`;
  const workspaceName = `Approval Workspace ${id}`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });

    await composer.fill(`Create a workspace called "${workspaceName}"`);
    await composer.press("Enter");
    await expect(page.getByRole("list", { name: "Agent conversation" })).toContainText(
      "The workspace is ready.",
    );
    await expect.poll(() => workspaceArchivedAt(email, workspaceName)).toBeNull();

    await composer.fill(`Archive the workspace called "${workspaceName}"`);
    await composer.press("Enter");

    // The tool is parked: the person sees the question, and nothing has
    // changed in the database yet.
    await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
    expect(await workspaceArchivedAt(email, workspaceName)).toBeNull();

    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("list", { name: "Agent conversation" })).toContainText("Archived.");
    await expect.poll(() => workspaceArchivedAt(email, workspaceName)).not.toBeNull();

    // Two prompts were sent; answering an approval is not a third.
    await expect.poll(() => promptCount(email)).toBe(2);

    // The answered card is gone from the replay; its reply is not.
    await page.reload();
    await expect(page.getByRole("list", { name: "Agent conversation" })).toContainText("Archived.");
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);

    await page
      .getByRole("textbox", { name: "Prompt" })
      .fill(`Delete the workspace called "${workspaceName}"`);
    await page.getByRole("textbox", { name: "Prompt" }).press("Enter");

    await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
    expect(await workspaceArchivedAt(email, workspaceName)).not.toBeNull();

    await page.getByRole("button", { name: "Approve" }).click();
    await expect.poll(() => workspaceArchivedAt(email, workspaceName)).toBeUndefined();
    await expect.poll(() => promptCount(email)).toBe(3);
  } finally {
    await deleteAccount(email);
  }
});

test("denying an approval leaves the workspace exactly as it was", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-deny-${id}@example.com`;
  const workspaceName = `Denied Workspace ${id}`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const thread = page.getByRole("list", { name: "Agent conversation" });

    await composer.fill(`Create a workspace called "${workspaceName}"`);
    await composer.press("Enter");
    await expect(thread).toContainText("The workspace is ready.");

    await composer.fill(`Archive the workspace called "${workspaceName}"`);
    await composer.press("Enter");
    await expect(page.getByRole("button", { name: "Deny" })).toBeVisible();

    await page.getByRole("button", { name: "Deny" }).click();
    await expect(thread).toContainText("Nothing changed.");

    expect(await workspaceArchivedAt(email, workspaceName)).toBeNull();
    await expect.poll(() => promptCount(email)).toBe(2);

    // The denial is recorded as the card's outcome, not as a second question.
    await page.reload();
    await expect(page.getByRole("list", { name: "Agent conversation" })).toContainText(
      "Nothing changed.",
    );
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  } finally {
    await deleteAccount(email);
  }
});
