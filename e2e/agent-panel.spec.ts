import { expect, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * The agent panel is mounted once for the whole workspaces section, so its
 * thread survives moving between the board and a workspace page. It is the
 * dashboard's conversation, not a second one: the open conversation is named in
 * the URL and leaving the query behind on an in-section link must not throw the
 * thread away.
 *
 * A panel send is also one ordinary prompt: one row, one turn, billed to the
 * account that is active and counted against that account's per-member meter.
 */

async function signUp(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Panel Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

async function findUserId(db: Client, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>('select id from "user" where email = $1', [
    email,
  ]);
  if (!rows[0]) throw new Error(`No user row for ${email}`);
  return rows[0].id;
}

type PromptRow = {
  text: string | null;
  conversationId: string;
  conversationOrganizationId: string | null;
  organizationId: string | null;
  userId: string;
  status: string;
  userMessages: number;
  assistantMessages: number;
};

/** Every prompt this person has run, with its account and its stored turn. */
async function promptRows(db: Client, email: string): Promise<PromptRow[]> {
  const { rows } = await db.query<PromptRow>(
    `select (select m.content->'parts'->0->>'text'
               from "agentMessage" m
              where m."promptId" = p.id and m.role = 'USER'
              limit 1) as text,
            p."conversationId" as "conversationId",
            p."organizationId" as "organizationId",
            p."userId" as "userId",
            p.status,
            c."organizationId" as "conversationOrganizationId",
            (select count(*)::int from "agentMessage" m
              where m."promptId" = p.id and m.role = 'USER') as "userMessages",
            (select count(*)::int from "agentMessage" m
              where m."promptId" = p.id and m.role = 'ASSISTANT') as "assistantMessages"
       from "agentPrompt" p
       left join "agentConversation" c on c.id = p."conversationId"
      where p."userId" = (select id from "user" where email = $1)
      order by p."createdAt"`,
    [email],
  );

  return rows;
}

async function waitForTurnsToClose(db: Client, email: string): Promise<void> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const { rows } = await db.query<{ total: number }>(
      `select count(*)::int as total from "agentPrompt"
        where "userId" = (select id from "user" where email = $1)
          and status in ('QUEUED', 'RUNNING')`,
      [email],
    );

    if ((rows[0]?.total ?? 0) === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function organizationIdFor(db: Client, email: string): Promise<string> {
  const { rows } = await db.query<{ organizationId: string }>(
    `select m.organization_id as "organizationId"
       from member m
      where m.user_id = (select id from "user" where email = $1)
      order by m.created_at desc
      limit 1`,
    [email],
  );
  if (!rows[0]) throw new Error(`No organization for ${email}`);
  return rows[0].organizationId;
}

test("the agent panel survives navigating through the workspaces section", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-panel-${id}@example.com`;
  const password = `e2e-pass-${id}`;
  const workspaceName = `Panel board ${id}`;
  const teamName = `Panel team ${id}`;

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  try {
    await signUp(page, { email, password });
    const userId = await findUserId(db, email);
    const workspaceId = randomUUID();
    await db.query(
      'insert into workspace (id, name, "creatorId", "orgId") values ($1, $2, $3, null)',
      [workspaceId, workspaceName, userId],
    );

    await test.step("the panel mounts on the workspaces board with the shared composer", async () => {
      await page.goto("/workspaces");

      const panel = page.getByRole("region", { name: "Agent panel" });
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("textbox", { name: "Prompt" })).toBeVisible();
    });

    await test.step("the panel collapses, expands and remembers its width on this device", async () => {
      const panel = page.getByRole("region", { name: "Agent panel" });
      // The handle is the panel group's separator, so it sits beside the panel
      // rather than inside it.
      const handle = page.getByRole("separator", { name: "Resize agent panel" });
      await expect(handle).toBeVisible();

      const opened = await panel.boundingBox();
      const handleBox = await handle.boundingBox();
      if (!opened || !handleBox) throw new Error("The panel has no measurable box");

      // The handle divides the page from the panel, so dragging it left hands
      // width to the panel.
      const centreY = handleBox.y + handleBox.height / 2;
      await page.mouse.move(handleBox.x + handleBox.width / 2, centreY);
      await page.mouse.down();
      await page.mouse.move(handleBox.x - 80, centreY, { steps: 5 });
      await page.mouse.up();

      await expect
        .poll(async () => (await panel.boundingBox())?.width ?? 0)
        .toBeGreaterThan(opened.width + 40);
      const widened = (await panel.boundingBox())?.width ?? 0;

      await page.reload();
      await expect(panel.getByRole("textbox", { name: "Prompt" })).toBeVisible();
      await expect
        .poll(async () => (await panel.boundingBox())?.width ?? 0)
        .toBeGreaterThan(opened.width + 40);
      const remembered = (await panel.boundingBox())?.width ?? 0;
      expect(Math.abs(remembered - widened)).toBeLessThanOrEqual(2);

      await panel.getByRole("button", { name: "Collapse agent panel" }).click();
      await expect(panel.getByRole("textbox", { name: "Prompt" })).toHaveCount(0);
      await expect(panel.getByRole("button", { name: "Expand agent panel" })).toBeVisible();

      await page.reload();
      await expect(panel.getByRole("button", { name: "Expand agent panel" })).toBeVisible();

      await panel.getByRole("button", { name: "Expand agent panel" }).click();
      await expect(panel.getByRole("textbox", { name: "Prompt" })).toBeVisible();
      await expect
        .poll(async () => (await panel.boundingBox())?.width ?? 0)
        .toBeGreaterThan(opened.width + 40);

      // The handle is a keyboard control too: the arrow keys resize the same
      // preference the pointer sets, so the panel is usable without a mouse.
      await handle.focus();
      const beforeKeys = (await panel.boundingBox())?.width ?? 0;
      await page.keyboard.press("ArrowLeft");
      await expect
        .poll(async () => (await panel.boundingBox())?.width ?? 0)
        .toBeGreaterThan(beforeKeys + 4);

      // Back to where the pointer left it, so the page keeps the room the rest
      // of the spec reads.
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(async () => Math.round((await panel.boundingBox())?.width ?? 0))
        .toBe(Math.round(beforeKeys));
    });

    await test.step("a prompt sent from the panel is the dashboard conversation", async () => {
      const panel = page.getByRole("region", { name: "Agent panel" });
      const composer = panel.getByRole("textbox", { name: "Prompt" });
      await expect(async () => {
        await composer.fill("Plan the roadmap");
        await composer.press("Enter");
        await expect(panel.getByRole("list", { name: "Agent conversation" })).toContainText(
          "Plan the roadmap",
          { timeout: 2_000 },
        );
      }).toPass({ timeout: 30_000 });

      await expect(panel.getByRole("list", { name: "Agent conversation" })).toContainText(
        "Stub agent: Plan the roadmap",
      );

      // One send is one prompt row, in the personal account that is active,
      // with one user message and one reply: no second session or send.
      await expect.poll(async () => (await promptRows(db, email)).length).toBe(1);
      await expect.poll(async () => (await promptRows(db, email))[0]?.status).toBe("COMPLETED");

      const [prompt] = await promptRows(db, email);
      expect(prompt?.text).toBe("Plan the roadmap");
      expect(prompt?.userId).toBe(userId);
      expect(prompt?.organizationId).toBeNull();
      expect(prompt?.conversationOrganizationId).toBeNull();
      expect(prompt?.conversationId).toBe(new URL(page.url()).searchParams.get("conversation"));
      expect(prompt?.userMessages).toBe(1);
      expect(prompt?.assistantMessages).toBe(1);

      // The header's per-member meter counted the same prompt once.
      await expect(
        page.getByRole("progressbar", { name: "Agent prompts usage" }).first(),
      ).toHaveAttribute("aria-valuetext", /^1 of \d+ used$/);
    });

    await test.step("navigating to a workspace keeps the same thread", async () => {
      const panel = page.getByRole("region", { name: "Agent panel" });

      await page.getByRole("link", { name: workspaceName }).click();
      await page.waitForURL(`**/workspaces/${workspaceId}**`);

      await expect(panel.getByRole("list", { name: "Agent conversation" })).toContainText(
        "Plan the roadmap",
      );
      // A link that dropped the query does not silently switch conversations:
      // the mounted panel puts its thread back into the URL.
      await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}\\?conversation=[^&]+`));
      await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();

      // The layout kept the composer mounted, and nothing re-sent on the way:
      // the thread still holds the one turn that was paid for.
      const [afterNavigation] = await promptRows(db, email);
      expect(afterNavigation?.conversationId).toBe(
        new URL(page.url()).searchParams.get("conversation"),
      );
      expect(afterNavigation?.userMessages).toBe(1);
      expect(afterNavigation?.assistantMessages).toBe(1);
    });

    await test.step("the agent is told which workspace the person is looking at", async () => {
      const panel = page.getByRole("region", { name: "Agent panel" });
      const composer = panel.getByRole("textbox", { name: "Prompt" });

      // The scripted fixture echoes the view context it was given in the system
      // message, so the page context is observed end to end rather than assumed.
      await composer.fill("Where am I looking?");
      await composer.press("Enter");

      await expect(panel.getByRole("list", { name: "Agent conversation" })).toContainText(
        `workspace ${workspaceId}`,
      );

      // The second prompt is a second row, not a resend of the first: the
      // mounted layout contributes no extra listener or turn.
      await expect.poll(async () => (await promptRows(db, email)).length).toBe(2);
      // A reply is on screen before its row is stored, so wait for the stored
      // turn rather than racing the write.
      await expect
        .poll(async () =>
          (await promptRows(db, email)).every(
            (row) =>
              row.status === "COMPLETED" && row.userMessages === 1 && row.assistantMessages === 1,
          ),
        )
        .toBe(true);

      const rows = await promptRows(db, email);
      expect(rows.filter((row) => row.text === "Plan the roadmap")).toHaveLength(1);
      expect(rows.filter((row) => row.text === "Where am I looking?")).toHaveLength(1);
    });

    await test.step("starting a new conversation stays inside the workspaces section", async () => {
      const panel = page.getByRole("region", { name: "Agent panel" });
      const newConversation = panel.getByRole("button", { name: "New conversation" });

      await expect(newConversation).toBeVisible({ timeout: 15_000 });
      await newConversation.click();

      await expect(page).not.toHaveURL(/\/dashboard/);
      await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}\\?conversation=[^&]+`));
      await expect(panel.getByRole("textbox", { name: "Prompt" })).toHaveValue("");
      await expect(panel.getByRole("list", { name: "Agent conversation" })).toHaveCount(0);
    });

    await test.step("a panel prompt is billed to the account that is active", async () => {
      await page.goto("/dashboard/organization");
      await page.getByLabel("Organization name").fill(teamName);
      await page.getByRole("button", { name: "Create organization" }).click();
      await expect(page.getByText(teamName).first()).toBeVisible({ timeout: 15_000 });
      const organizationId = await organizationIdFor(db, email);

      // A different layout remounts the panel, so it opens in the new account.
      await page.goto("/workspaces");
      const panel = page.getByRole("region", { name: "Agent panel" });
      const composer = panel.getByRole("textbox", { name: "Prompt" });

      await expect(async () => {
        await composer.fill("Team plan from the panel");
        await composer.press("Enter");
        await expect(panel.getByRole("list", { name: "Agent conversation" })).toContainText(
          "Team plan from the panel",
          { timeout: 2_000 },
        );
      }).toPass({ timeout: 30_000 });
      await expect(panel.getByRole("list", { name: "Agent conversation" })).toContainText(
        "Stub agent: Team plan from the panel",
      );

      await expect
        .poll(
          async () =>
            (await promptRows(db, email)).filter(
              (row) =>
                row.text === "Team plan from the panel" &&
                row.status === "COMPLETED" &&
                row.userMessages === 1 &&
                row.assistantMessages === 1,
            ).length,
        )
        .toBe(1);

      const teamPrompt = (await promptRows(db, email)).find(
        (row) => row.text === "Team plan from the panel",
      );

      // The active organization pays, and the conversation is filed there too.
      expect(teamPrompt?.organizationId).toBe(organizationId);
      expect(teamPrompt?.conversationOrganizationId).toBe(organizationId);
      expect(teamPrompt?.status).toBe("COMPLETED");
      expect(teamPrompt?.userMessages).toBe(1);
      expect(teamPrompt?.assistantMessages).toBe(1);

      // The organization's meter counts its own member once; the personal
      // prompts above are not charged to it.
      await expect(
        page.getByRole("progressbar", { name: "Agent prompts usage" }).first(),
      ).toHaveAttribute("aria-valuetext", /^1 of \d+ used$/);
    });

    await test.step("the dashboard keeps its own inline composer and no panel", async () => {
      await page.goto("/dashboard");

      await expect(
        page.getByRole("heading", { name: "What are we planning today?" }),
      ).toBeVisible();
      await expect(page.getByRole("region", { name: "Agent panel" })).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: "Prompt" })).toBeVisible();
    });

    await test.step("the archived workspaces page carries the same panel", async () => {
      await page.goto("/dashboard/archive");

      await expect(page.getByRole("heading", { name: "Archived workspaces" })).toBeVisible();
      const panel = page.getByRole("region", { name: "Agent panel" });
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("textbox", { name: "Prompt" })).toBeVisible();
    });
  } finally {
    await waitForTurnsToClose(db, email).catch(() => undefined);
    await db.query("delete from workspace where name = $1", [workspaceName]).catch(() => undefined);
    await db
      .query(
        `delete from organization
          where id in (select organization_id from member
                        where user_id = (select id from "user" where email = $1))`,
        [email],
      )
      .catch(() => undefined);
    await db.query('delete from "user" where email = $1', [email]).catch(() => undefined);
    await db.end();
  }
});
