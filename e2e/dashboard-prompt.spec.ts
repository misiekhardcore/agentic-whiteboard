import { expect, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * The dashboard opens with a prompt composer for the agent: Enter sends,
 * Shift+Enter keeps a line break, and sending runs a real request through
 * `/api/agent/prompts`. Playwright starts a scripted OpenAI-compatible endpoint
 * and points `AI_BASE_URL` at it, so the replies are deterministic and the same
 * HTTP contract production uses is what the suite exercises.
 */

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Prompt Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

/**
 * A turn looks finished in the browser before the route has stored its reply
 * and closed the prompt. Deleting the account while that write is in flight
 * cascades the prompt away under the assistant message; a short wait lets the
 * turn land first.
 */
async function waitForTurnsToClose(email: string) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const open = await withDb(async (db) => {
      const { rows } = await db.query<{ total: number }>(
        `select count(*)::int as total from "agentPrompt"
          where "userId" = (select id from "user" where email = $1)
            and status in ('QUEUED', 'RUNNING')`,
        [email],
      );

      return rows[0]?.total ?? 0;
    });

    if (open === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function deleteAccount(email: string) {
  await waitForTurnsToClose(email).catch(() => undefined);

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
    const { rows } = await db.query<{ archivedAt: Date | null }>(
      `select "archivedAt" from workspace
        where name = $1
          and "creatorId" = (select id from "user" where email = $2)`,
      [name, email],
    );

    return rows[0] ? rows[0].archivedAt : undefined;
  });
}

async function promptCount(email: string): Promise<number> {
  return withDb(async (db) => {
    const { rows } = await db.query<{ total: number }>(
      `select count(*)::int as total from "agentPrompt"
        where "userId" = (select id from "user" where email = $1)`,
      [email],
    );

    return rows[0]?.total ?? 0;
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

test("a prompt left RUNNING by a restarted server does not block the thread", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-orphan-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    // A server killed mid-stream leaves its prompt QUEUED/RUNNING forever. The
    // single-flight index then refuses every later send on the thread, and the
    // process that could have finished the row is gone.
    const orphanId = `orphan_${id}`;
    const seeded = await withDb(async (db) => {
      const { rowCount } = await db.query(
        `insert into "agentPrompt" (id, "ownerId", "userId", status, provider, model, "startedAt")
         select $1, u.id, u.id, 'RUNNING', 'stub', 'stub-model', now()
           from "user" u where u.email = $2`,
        [orphanId, email],
      );

      return rowCount ?? 0;
    });
    expect(seeded).toBe(1);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const thread = page.getByRole("list", { name: "Agent conversation" });

    await composer.fill("Anything new?");
    await composer.press("Enter");

    // The send goes through instead of failing on the index, and the reply is a
    // real turn rather than the busy notice.
    await expect(thread).toContainText("Stub agent: Anything new?");
    await expect(thread).not.toContainText("still working on your previous prompt");

    const orphan = await withDb(async (db) => {
      const { rows } = await db.query<{ status: string; error: string | null }>(
        `select status, error from "agentPrompt" where id = $1`,
        [orphanId],
      );

      return rows[0];
    });

    expect(orphan?.status).toBe("FAILED");
    expect(orphan?.error).toContain("stopped before finishing");
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
    await expect(thread).toContainText('"link": "/workspaces/');

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

    // The answered card is gone from the replay; its reply is not. The reply
    // is persisted when the turn closes, so reloading before that loses it.
    await waitForTurnsToClose(email);
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
    await waitForTurnsToClose(email);
    await page.reload();
    await expect(page.getByRole("list", { name: "Agent conversation" })).toContainText(
      "Nothing changed.",
    );
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  } finally {
    await deleteAccount(email);
  }
});

/** The conversations this person owns, newest first. */
async function conversationCount(email: string): Promise<number> {
  return withDb(async (db) => {
    const { rows } = await db.query<{ total: number }>(
      `select count(*)::int as total from "agentConversation"
        where "userId" = (select id from "user" where email = $1)`,
      [email],
    );

    return rows[0]?.total ?? 0;
  });
}

/** Every prompt this person ever wrote, superseded ones included. */
async function promptRows(
  email: string,
): Promise<{ status: string; supersededAt: Date | null; conversationId: string | null }[]> {
  return withDb(async (db) => {
    const { rows } = await db.query<{
      status: string;
      supersededAt: Date | null;
      conversationId: string | null;
    }>(
      `select status, "supersededAt", "conversationId" from "agentPrompt"
        where "userId" = (select id from "user" where email = $1)
        order by "createdAt"`,
      [email],
    );

    return rows;
  });
}

/**
 * A conversation whose newest prompt failed, with the partial reply the failed
 * attempt stored. The thread must offer a retry without the person retyping
 * anything, and the retry must reuse that prompt.
 */
async function seedFailedPrompt(
  email: string,
  conversationId: string,
  text: string,
  reply: string,
): Promise<void> {
  await withDb(async (db) => {
    await db.query(
      `insert into "agentConversation" (id, "userId")
        select $1, id from "user" where email = $2`,
      [conversationId, email],
    );
    await db.query(
      `insert into "agentPrompt" (id, "ownerId", "userId", "conversationId", status, provider, model)
        select $1, u.id, u.id, $2, 'FAILED', 'stub', 'stub-model'
          from "user" u where u.email = $3`,
      [`${conversationId}-prompt`, conversationId, email],
    );
    await db.query(
      `insert into "agentMessage" (id, "promptId", role, content, "actorType", "userId")
        select $1, $2, 'USER', $3::jsonb, 'USER', id from "user" where email = $4`,
      [
        `${conversationId}-user`,
        `${conversationId}-prompt`,
        JSON.stringify({ parts: [{ type: "text", text }] }),
        email,
      ],
    );
    await db.query(
      `insert into "agentMessage" (id, "promptId", role, content, "actorType", "createdAt")
        values ($1, $2, 'ASSISTANT', $3::jsonb, 'AGENT', now() + interval '1 second')`,
      [
        `${conversationId}-reply`,
        `${conversationId}-prompt`,
        JSON.stringify({ parts: [{ type: "text", text: reply }] }),
      ],
    );
  });
}

/**
 * A stored conversation with one finished turn, so the history dialog can be
 * exercised without sending six prompts through the model. Its timestamps put
 * it where `minutesAgo` says it sits in the list.
 */
async function seedConversation({
  email,
  conversationId,
  prompt,
  minutesAgo,
}: {
  email: string;
  conversationId: string;
  prompt: string;
  minutesAgo: number;
}): Promise<void> {
  const at = `${minutesAgo} minutes`;

  await withDb(async (db) => {
    await db.query(
      `insert into "agentConversation" (id, "userId", "createdAt", "updatedAt")
        select $1, id, now() - $3::interval, now() - $3::interval
          from "user" where email = $2`,
      [conversationId, email, at],
    );
    await db.query(
      `insert into "agentPrompt" (id, "ownerId", "userId", "conversationId", status, provider, model, "createdAt")
        select $1 || '-prompt', u.id, u.id, $1, 'COMPLETED', 'stub', 'stub-model', now() - $3::interval
          from "user" u where u.email = $2`,
      [conversationId, email, at],
    );
    await db.query(
      `insert into "agentMessage" (id, "promptId", role, content, "actorType", "userId", "createdAt")
        select $1 || '-user', $1 || '-prompt', 'USER', $3::jsonb, 'USER', u.id, now() - $4::interval
          from "user" u where u.email = $2`,
      [conversationId, email, JSON.stringify({ parts: [{ type: "text", text: prompt }] }), at],
    );
    await db.query(
      `insert into "agentMessage" (id, "promptId", role, content, "actorType", "createdAt")
        values ($1 || '-reply', $1 || '-prompt', 'ASSISTANT', $2::jsonb, 'AGENT',
                now() - $3::interval + interval '1 second')`,
      [
        conversationId,
        JSON.stringify({ parts: [{ type: "text", text: `Reply to ${prompt}` }] }),
        at,
      ],
    );
  });
}

/** A conversation long enough that its thread has to scroll. */
async function seedScrollThread(email: string, conversationId: string): Promise<void> {
  await withDb(async (db) => {
    await db.query(
      `insert into "agentConversation" (id, "userId")
        select $1, id from "user" where email = $2`,
      [conversationId, email],
    );
    await db.query(
      `insert into "agentPrompt" (id, "ownerId", "userId", "conversationId", status, provider, model, "createdAt")
        select $1 || '-p' || g, u.id, u.id, $1, 'COMPLETED', 'stub', 'stub-model',
               now() + (g || ' seconds')::interval
          from "user" u, generate_series(1, 15) g
          where u.email = $2`,
      [conversationId, email],
    );
    await db.query(
      `insert into "agentMessage" (id, "promptId", role, content, "actorType", "userId", "createdAt")
        select $1 || '-u' || g, $1 || '-p' || g, 'USER',
               jsonb_build_object('parts', jsonb_build_array(
                 jsonb_build_object('type', 'text', 'text', 'Scroll prompt ' || g)
               )),
               'USER', u.id, now() + (g || ' seconds')::interval
          from "user" u, generate_series(1, 15) g
          where u.email = $2`,
      [conversationId, email],
    );
    await db.query(
      `insert into "agentMessage" (id, "promptId", role, content, "actorType", "createdAt")
        select $1 || '-a' || g, $1 || '-p' || g, 'ASSISTANT',
               jsonb_build_object('parts', jsonb_build_array(
                 jsonb_build_object('type', 'text', 'text',
                   'Scroll reply ' || g || ', long enough to take a line or two of the thread so the box has to scroll.')
               )),
               'AGENT', now() + (g || ' seconds')::interval + interval '500 milliseconds'
          from generate_series(1, 15) g`,
      [conversationId],
    );
  });
}

test("a new conversation starts empty and the switcher brings the last one back", async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-new-thread-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const thread = page.getByRole("list", { name: "Agent conversation" });

    await composer.fill("First thread");
    await composer.press("Enter");
    await expect(thread).toContainText("Stub agent: First thread");

    await page.getByRole("button", { name: "New conversation" }).click();

    // The new thread is a place, not a blank page: the URL names it, the thread
    // has nothing in it, and the composer is ready for its first prompt.
    await expect(page).toHaveURL(/conversation=/);
    await expect(thread).toHaveCount(0);
    await expect(composer).toHaveValue("");

    await composer.fill("Second thread");
    await composer.press("Enter");
    await expect(thread).toContainText("Stub agent: Second thread");

    // A pill is a link to the conversation, styled as a button.
    const switcher = page.getByRole("group", { name: "Recent conversations" });
    await expect(switcher.getByRole("link", { name: "First thread" })).toBeVisible();
    await switcher.getByRole("link", { name: "First thread" }).click();

    await expect(thread).toContainText("Stub agent: First thread");
    await expect(thread).not.toContainText("Second thread");

    // The conversation is what the URL names, so a reload keeps it.
    await page.reload();
    await expect(page.getByRole("list", { name: "Agent conversation" })).toContainText(
      "Stub agent: First thread",
    );

    expect(await conversationCount(email)).toBe(2);
    await expect.poll(() => promptCount(email)).toBe(2);
  } finally {
    await deleteAccount(email);
  }
});

test("the history dialog lists every conversation, including ones the pills cannot show", async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-history-${id}@example.com`;
  const oldest = randomUUID();

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    // Six conversations, one more than the pills can name.
    await seedConversation({
      email,
      conversationId: oldest,
      prompt: "The oldest thread",
      minutesAgo: 60,
    });
    for (let index = 2; index <= 6; index += 1) {
      await seedConversation({
        email,
        conversationId: randomUUID(),
        prompt: `Seeded thread ${index}`,
        minutesAgo: 70 - index * 10,
      });
    }

    await page.goto("/dashboard");

    // The pills stop at the recent few, so the oldest thread is not among them.
    const switcher = page.getByRole("group", { name: "Recent conversations" });
    await expect(switcher).toBeVisible();
    await expect(switcher.getByText("The oldest thread")).toHaveCount(0);

    await page.getByRole("button", { name: "History" }).click();

    // The dialog reads the whole list, newest first.
    const dialog = page.getByRole("dialog", { name: "Conversation history" });
    const entries = dialog.getByRole("link");
    await expect(entries).toHaveCount(6);
    await expect(entries.first()).toContainText("Seeded thread 6");
    await expect(dialog.getByRole("link", { name: "The oldest thread" })).toBeVisible();

    // Choosing one opens it and closes the dialog.
    await dialog.getByRole("link", { name: "The oldest thread" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`conversation=${oldest}`));
    const thread = page.getByRole("list", { name: "Agent conversation" });
    await expect(thread).toContainText("Reply to The oldest thread");
    await expect(thread).not.toContainText("Seeded thread 6");
  } finally {
    await deleteAccount(email);
  }
});

test("editing an earlier prompt replaces it and the turns after it", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-rewind-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const thread = page.getByRole("list", { name: "Agent conversation" });

    await composer.fill("Plan the schema");
    await composer.press("Enter");
    await expect(thread).toContainText("Stub agent: Plan the schema");

    await composer.fill("Now the API");
    await composer.press("Enter");
    await expect(thread).toContainText("Stub agent: Now the API");
    await expect.poll(() => promptCount(email)).toBe(2);

    // Edit the first prompt: it fills the composer and says what sending does.
    await thread.getByRole("button", { name: "Edit this prompt" }).first().click();
    await expect(composer).toHaveValue("Plan the schema");
    await expect(page.getByText(/Editing an earlier prompt/)).toBeVisible();

    await composer.fill("Plan the cache");
    await composer.press("Enter");

    // The conversation continues from the edited turn: the later prompt and the
    // old reply are gone, and only one prompt is left to edit.
    await expect(thread).toContainText("Stub agent: Plan the cache");
    await expect(thread).not.toContainText("Now the API");
    await expect(thread).not.toContainText("Stub agent: Plan the schema");
    await expect(thread.getByRole("button", { name: "Edit this prompt" })).toHaveCount(1);
    await expect(page.getByText(/Editing an earlier prompt/)).toHaveCount(0);

    // Nothing was deleted: both discarded prompts still count.
    await expect.poll(() => promptCount(email)).toBe(3);
    const rows = await promptRows(email);
    expect(rows.filter((row) => row.supersededAt !== null)).toHaveLength(2);
    expect(new Set(rows.map((row) => row.conversationId)).size).toBe(1);
    expect(await conversationCount(email)).toBe(1);

    await page.reload();
    await expect(page.getByRole("list", { name: "Agent conversation" })).toContainText(
      "Stub agent: Plan the cache",
    );
    await expect(page.getByRole("list", { name: "Agent conversation" })).not.toContainText(
      "Now the API",
    );
  } finally {
    await deleteAccount(email);
  }
});

test("a failed send can be retried without retyping the prompt", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-retry-failed-${id}@example.com`;

  let attempts = 0;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const thread = page.getByRole("list", { name: "Agent conversation" });

    // The first attempt fails before it reaches the route, which is what an
    // outage looks like from the browser.
    await page.route("**/api/agent/prompts", async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: "The agent could not finish that prompt. Try again in a moment.",
          }),
        });
        return;
      }
      await route.continue();
    });

    await composer.fill("Plan the schema");
    await composer.press("Enter");

    await expect(
      page.getByText("The agent could not finish that prompt. Try again in a moment.").first(),
    ).toBeVisible();
    await expect.poll(() => promptCount(email)).toBe(0);

    await page.getByRole("button", { name: "Retry" }).click();

    await expect(thread).toContainText("Stub agent: Plan the schema");
    // One prompt bubble, not the failed one plus a second copy.
    await expect(thread.getByRole("button", { name: "Edit this prompt" })).toHaveCount(1);
    await expect.poll(() => promptCount(email)).toBe(1);
  } finally {
    await page.unroute("**/api/agent/prompts");
    await deleteAccount(email);
  }
});

test("a prompt that failed on the server is retryable after a reload, for free", async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-retry-stored-${id}@example.com`;
  const conversationId = `seed-failed-${id}`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);
    await seedFailedPrompt(email, conversationId, "Seed prompt", "Stub agent: partial");

    await page.goto(`/dashboard?conversation=${conversationId}`);

    const thread = page.getByRole("list", { name: "Agent conversation" });
    await expect(thread).toContainText("Seed prompt");
    await expect(thread).toContainText("Stub agent: partial");

    // The stored prompt failed, so the thread itself offers the retry.
    await expect(page.getByText(/The last prompt did not finish/)).toBeVisible();
    await page.getByRole("button", { name: "Retry" }).click();

    await expect(thread).toContainText("Stub agent: Seed prompt");
    await expect.poll(async () => (await promptRows(email))[0]?.status).toBe("COMPLETED");
    // A retry is not a new prompt: the person already paid for it.
    expect(await promptCount(email)).toBe(1);

    await page.reload();
    await expect(page.getByRole("list", { name: "Agent conversation" })).toContainText(
      "Stub agent: Seed prompt",
    );
    // The failed attempt's reply is superseded, not deleted.
    await expect(page.getByRole("list", { name: "Agent conversation" })).not.toContainText(
      "Stub agent: partial",
    );
  } finally {
    await deleteAccount(email);
  }
});

test("the conversation scrolls in its own box instead of growing the page", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-scroll-${id}@example.com`;
  const conversationId = `seed-scroll-${id}`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);
    await seedScrollThread(email, conversationId);

    await page.goto(`/dashboard?conversation=${conversationId}`);

    const thread = page.getByRole("list", { name: "Agent conversation" });
    await expect(thread).toContainText("Scroll reply 15");

    const box = thread.locator("xpath=..");
    const metrics = await box.evaluate((element) => ({
      overflowY: getComputedStyle(element).overflowY,
      maxHeight: getComputedStyle(element).maxHeight,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      distanceFromBottom: element.scrollHeight - element.scrollTop - element.clientHeight,
    }));

    expect(metrics.overflowY).toBe("auto");
    expect(metrics.maxHeight).not.toBe("none");
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    // The newest message is in view without scrolling the page at all. The box
    // positions itself once the page hydrates, so the position is polled: on a
    // loaded machine the server-rendered thread is readable before the effect
    // that follows it has run.
    await expect
      .poll(() =>
        box.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight),
      )
      .toBeLessThanOrEqual(2);

    const documentScrolls = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    expect(documentScrolls).toBe(false);
  } finally {
    await deleteAccount(email);
  }
});

/** The prompts a branch copied in: the replays the allowance does not count. */
async function branchCopies(
  email: string,
): Promise<{ conversationId: string | null; branchedFromId: string | null }[]> {
  return withDb(async (db) => {
    const { rows } = await db.query<{
      conversationId: string | null;
      branchedFromId: string | null;
    }>(
      `select "conversationId", "branchedFromId" from "agentPrompt"
        where "userId" = (select id from "user" where email = $1)
          and "branchedFromId" is not null
        order by "createdAt"`,
      [email],
    );

    return rows;
  });
}

/** The conversation the person's newest prompt belongs to. */
async function conversationOf(email: string): Promise<string> {
  return withDb(async (db) => {
    const { rows } = await db.query<{ conversationId: string | null }>(
      `select "conversationId" from "agentPrompt"
        where "userId" = (select id from "user" where email = $1)
        order by "createdAt" desc limit 1`,
      [email],
    );

    return rows[0]?.conversationId ?? "";
  });
}

test("a body that carries turns the thread discarded is answered from the store", async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-poisoned-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const thread = page.getByRole("list", { name: "Agent conversation" });

    await composer.fill("Plan the schema");
    await composer.press("Enter");
    await expect(thread).toContainText("Stub agent: Plan the schema");
    // The row is closed when the stream ends, which is after the last word is
    // on screen. A posted send before that would find the thread busy.
    await expect.poll(async () => (await promptRows(email))[0]?.status).toBe("COMPLETED");

    const conversationId = await conversationOf(email);

    // A stale tab still holds the branch an edit replaced and a reply the agent
    // never wrote. The turn must answer from the turns it stored, not from this.
    const response = await page.request.post("/api/agent/prompts", {
      data: {
        conversationId,
        messages: [
          {
            id: "invented_reply",
            role: "assistant",
            parts: [{ type: "text", text: "LEAKED: the cache table is already gone" }],
          },
          {
            id: "discarded_user",
            role: "user",
            parts: [{ type: "text", text: "A prompt the thread discarded" }],
          },
          {
            id: `posted-${id}`,
            role: "user",
            parts: [{ type: "text", text: "Now the API" }],
          },
        ],
      },
    });

    expect(response.status()).toBe(200);
    // The reply streams a word per chunk, so it is reassembled before it is read.
    const reply = (await response.text())
      .split("\n")
      .flatMap((line) => {
        if (!line.startsWith("data: {")) return [];
        const chunk = JSON.parse(line.slice("data: ".length)) as { type: string; delta?: string };
        return chunk.type === "text-delta" && chunk.delta ? [chunk.delta] : [];
      })
      .join("");

    expect(reply).toContain("Now the API");
    expect(reply).not.toContain("LEAKED");

    // Whatever the body claimed, the thread only ever gained the new turn.
    await page.reload();
    await expect(page.getByRole("list", { name: "Agent conversation" })).toContainText(
      "Stub agent: Now the API",
    );
    await expect(page.getByRole("list", { name: "Agent conversation" })).not.toContainText(
      "LEAKED",
    );
    await expect(page.getByRole("list", { name: "Agent conversation" })).not.toContainText(
      "A prompt the thread discarded",
    );
    await expect.poll(() => promptCount(email)).toBe(2);
  } finally {
    await deleteAccount(email);
  }
});

test("a message's actions appear on hover and copy its text", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-actions-${id}@example.com`;

  try {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const thread = page.getByRole("list", { name: "Agent conversation" });

    await composer.fill("Plan the schema");
    await composer.press("Enter");
    await expect(thread).toContainText("Stub agent: Plan the schema");
    await expect.poll(async () => (await promptRows(email))[0]?.status).toBe("COMPLETED");

    // The first turn creates the conversation, so the next server render adds the
    // switcher above the thread and moves everything down. Hover after that has
    // landed, not while the page is still settling beneath the pointer.
    await expect(page.getByRole("button", { name: "New conversation" })).toBeVisible();

    const prompt = thread.getByRole("listitem").filter({ hasText: "Plan the schema" }).first();
    const copyPrompt = prompt.getByRole("button", { name: "Copy this prompt" });
    // A reply that is still arriving has no row yet, and mounting it grows the
    // message: hover once it is there, the way a person does when they read.
    await copyPrompt.waitFor();
    // The row is what fades, so the opacity that matters is the row's.
    const promptActions = copyPrompt.locator("xpath=..");

    // The actions belong to the message: out of the way until it is hovered.
    await expect(promptActions).toHaveCSS("opacity", "0");
    await prompt.hover();
    await expect(promptActions).toHaveCSS("opacity", "1");

    await copyPrompt.click();
    await expect(page.getByText("Copied to the clipboard")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Plan the schema");

    // The reply offers its own row: copy, read aloud, and the two ways to carry
    // the thread on from here.
    const reply = thread.getByRole("listitem").filter({ hasText: "Stub agent" });
    const copyReply = reply.getByRole("button", { name: "Copy this reply" });
    await copyReply.waitFor();
    const replyActions = copyReply.locator("xpath=..");
    await expect(replyActions).toHaveCSS("opacity", "0");
    await reply.hover();
    await expect(replyActions).toHaveCSS("opacity", "1");
    await expect(reply.getByRole("button", { name: "Read this reply aloud" })).toBeVisible();
    await expect(reply.getByRole("button", { name: "Regenerate this reply" })).toBeVisible();
    await expect(
      reply.getByRole("button", { name: "Branch this conversation into a new chat" }),
    ).toBeVisible();

    // A reply is copied as the agent wrote it — its markdown, not its rendered
    // text — so pasting it somewhere else keeps the formatting.
    await copyReply.click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "**Stub agent:** Plan the schema",
    );

    // An icon is the whole button, so the label it means has to be on screen
    // somewhere: hovering it is the only way to learn what it does. (The copy
    // buttons were just clicked, and a click dismisses a tooltip, so this uses
    // one that was not.)
    await prompt.getByRole("button", { name: "Edit this prompt" }).hover();
    await expect(page.getByRole("tooltip")).toHaveText("Edit this prompt");
  } finally {
    await deleteAccount(email);
  }
});

test("regenerating the newest reply runs its prompt again as a new turn", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-regenerate-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const thread = page.getByRole("list", { name: "Agent conversation" });

    await composer.fill("Plan the schema");
    await composer.press("Enter");
    await expect(thread).toContainText("Stub agent: Plan the schema");
    await expect.poll(async () => (await promptRows(email))[0]?.status).toBe("COMPLETED");

    await thread
      .getByRole("listitem")
      .filter({ hasText: "Stub agent" })
      .getByRole("button", { name: "Regenerate this reply" })
      .click();

    await expect(thread).toContainText("Stub agent: Plan the schema");
    // One turn, re-run: the reply the person replaced is superseded rather than
    // deleted, so the thread still shows a single answer and the count grows.
    await expect(thread.getByRole("button", { name: "Regenerate this reply" })).toHaveCount(1);
    await expect.poll(() => promptCount(email)).toBe(2);
    await expect
      .poll(async () => (await promptRows(email)).filter((row) => row.supersededAt !== null).length)
      .toBe(1);
  } finally {
    await deleteAccount(email);
  }
});

test("branching a conversation opens a new chat with a copy of its turns", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-branch-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const thread = page.getByRole("list", { name: "Agent conversation" });

    await composer.fill("Plan the schema");
    await composer.press("Enter");
    await expect(thread).toContainText("Stub agent: Plan the schema");

    await composer.fill("Now the API");
    await composer.press("Enter");
    await expect(thread).toContainText("Stub agent: Now the API");
    await expect.poll(() => promptCount(email)).toBe(2);
    await expect.poll(async () => (await promptRows(email))[1]?.status).toBe("COMPLETED");

    const original = await conversationOf(email);

    // The count the plan enforces, before the copy exists.
    await page.goto("/dashboard/billing");
    // The header carries the same meter as the page, so the page's is first.
    const meter = page.getByRole("progressbar", { name: "Agent prompts usage" }).first();
    const usedBefore = await meter.getAttribute("aria-valuetext");

    await page.goto(`/dashboard?conversation=${original}`);
    const reply = page
      .getByRole("list", { name: "Agent conversation" })
      .getByRole("listitem")
      .filter({ hasText: "Stub agent: Now the API" });
    await reply.hover();
    await reply.getByRole("button", { name: "Branch this conversation into a new chat" }).click();

    // The branch is a conversation of its own, opened at the reply it copied.
    await expect(page).not.toHaveURL(new RegExp(`conversation=${original}`));
    const branch = page.getByRole("list", { name: "Agent conversation" });
    await expect(branch).toContainText("Stub agent: Plan the schema");
    await expect(branch).toContainText("Stub agent: Now the API");

    // Every copied turn points at the prompt it came from...
    await expect.poll(() => branchCopies(email)).toHaveLength(2);
    const copies = await branchCopies(email);
    expect(copies.every((copy) => copy.branchedFromId !== null)).toBe(true);
    expect(new Set(copies.map((copy) => copy.conversationId)).size).toBe(1);

    // ...and none of them is charged for again: the turn ran once.
    await page.goto("/dashboard/billing");
    await expect(
      page.getByRole("progressbar", { name: "Agent prompts usage" }).first(),
    ).toHaveAttribute("aria-valuetext", usedBefore ?? "");

    // The conversation it came from is untouched and still usable.
    await page.goto(`/dashboard?conversation=${original}`);
    await expect(page.getByRole("list", { name: "Agent conversation" })).toContainText(
      "Stub agent: Now the API",
    );
    await expect(page.getByRole("textbox", { name: "Prompt" })).toBeEnabled();

    await expect.poll(() => promptCount(email)).toBe(4);
  } finally {
    await deleteAccount(email);
  }
});
