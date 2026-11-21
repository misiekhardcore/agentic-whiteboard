import { expect, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * A conversation belongs to a person inside one account. The switcher, the
 * history dialog and the thread change when the account does, and a prompt sent
 * while an organization is active is still billed to that organization.
 */

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Account Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
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

async function createOrganization(page: Page, name: string) {
  await page.goto("/dashboard/organization");
  await page.getByLabel("Organization name").fill(name);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
}

/**
 * The switch is a server action that carries the new active account. Waiting
 * for the header to name it means a following navigation cannot cancel it.
 */
async function switchAccount(page: Page, option: RegExp, resultingName: RegExp) {
  await page.getByRole("button", { name: /Account menu for/ }).click();
  await page.getByRole("button", { name: option }).click();
  await expect(page.getByRole("button", { name: resultingName })).toBeVisible({
    timeout: 15_000,
  });
}

async function deleteAccount(email: string) {
  await withDb(async (db) => {
    await db
      .query(
        `delete from organization
          where id in (select organization_id from member
                        where user_id = (select id from "user" where email = $1))`,
        [email],
      )
      .catch(() => undefined);
    await db.query('delete from "user" where email = $1', [email]).catch(() => undefined);
  });
}

test("a conversation stays in the account it was started in", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-accounts-${id}@example.com`;
  const teamName = `Accounts Team ${id}`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const thread = page.getByRole("list", { name: "Agent conversation" });
    const switcher = page.getByRole("group", { name: "Recent conversations" });

    await test.step("the personal account holds its own conversation", async () => {
      await composer.fill("Personal plan");
      await composer.press("Enter");
      await expect(thread).toContainText("Stub agent: Personal plan");
      await expect(switcher.getByRole("link", { name: "Personal plan" })).toBeVisible();
    });

    await test.step("activating an organization starts an empty conversation set", async () => {
      await createOrganization(page, teamName);

      await page.goto("/dashboard");
      await expect(switcher).toHaveCount(0);
      await expect(thread).toHaveCount(0);
      await expect(page.getByText("Personal plan")).toHaveCount(0);
    });

    await test.step("an organization conversation is listed only there", async () => {
      await composer.fill("Team plan");
      await composer.press("Enter");
      await expect(thread).toContainText("Stub agent: Team plan");
      await expect(switcher.getByRole("link", { name: "Team plan" })).toBeVisible();
      await expect(switcher.getByRole("link", { name: "Personal plan" })).toHaveCount(0);

      await page.getByRole("button", { name: "History" }).click();
      const dialog = page.getByRole("dialog", { name: "Conversation history" });
      await expect(dialog.getByRole("link")).toHaveCount(1);
      await expect(dialog.getByRole("link", { name: "Team plan" })).toBeVisible();
      await expect(dialog.getByRole("link", { name: "Personal plan" })).toHaveCount(0);
      await page.keyboard.press("Escape");
    });

    await test.step("switching back restores the personal set unchanged", async () => {
      await switchAccount(page, /Personal account/, /Account menu for Account Tester/);
      await page.goto("/dashboard");

      await expect(switcher.getByRole("link", { name: "Personal plan" })).toBeVisible();
      await expect(switcher.getByRole("link", { name: "Team plan" })).toHaveCount(0);
      await expect(thread).toContainText("Stub agent: Personal plan");
      await expect(thread).not.toContainText("Team plan");

      await page.getByRole("button", { name: "History" }).click();
      const dialog = page.getByRole("dialog", { name: "Conversation history" });
      await expect(dialog.getByRole("link")).toHaveCount(1);
      await expect(dialog.getByRole("link", { name: "Personal plan" })).toBeVisible();
      await expect(dialog.getByRole("link", { name: "Team plan" })).toHaveCount(0);
      await page.keyboard.press("Escape");
    });

    await test.step("the organization's prompt is billed to the organization, once", async () => {
      const rows = await withDb(async (db) => {
        const { rows } = await db.query<{
          text: string;
          ownerId: string;
          userId: string;
          accountType: string;
          accountId: string;
        }>(
          `select m.content->'parts'->0->>'text' as text,
                  p."ownerId", p."userId", c."accountType", c."accountId"
             from "agentPrompt" p
             join "agentMessage" m on m."promptId" = p.id and m.role = 'USER'
             join "agentConversation" c on c.id = p."conversationId"
            where p."userId" = (select id from "user" where email = $1)
            order by p."createdAt"`,
          [email],
        );
        return rows;
      });

      const personal = rows.find((row) => row.text === "Personal plan");
      const team = rows.find((row) => row.text === "Team plan");

      expect(personal?.accountType).toBe("PERSONAL");
      expect(personal?.ownerId).toBe(personal?.userId);
      expect(team?.accountType).toBe("ORGANIZATION");
      expect(team?.accountId).not.toBe(team?.userId);
      expect(team?.ownerId).toBe(team?.accountId);
      expect(rows).toHaveLength(2);
    });
  } finally {
    await deleteAccount(email);
  }
});

test("the other account's conversation id is not opened", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-accounts-url-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const thread = page.getByRole("list", { name: "Agent conversation" });

    await composer.fill("Personal plan");
    await composer.press("Enter");
    await expect(thread).toContainText("Stub agent: Personal plan");

    const personalConversationId = await withDb(async (db) => {
      const { rows } = await db.query<{ conversationId: string }>(
        `select "conversationId" from "agentPrompt"
          where "userId" = (select id from "user" where email = $1)
          order by "createdAt" desc limit 1`,
        [email],
      );
      return rows[0]?.conversationId ?? "";
    });
    expect(personalConversationId).not.toBe("");

    await createOrganization(page, `Accounts Url Team ${id}`);

    // A personal link, opened while the organization is active.
    await page.goto(`/dashboard?conversation=${personalConversationId}`);
    await expect(page.getByRole("list", { name: "Agent conversation" })).toHaveCount(0);
    await expect(page.getByText("Personal plan")).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("list", { name: "Agent conversation" })).toHaveCount(0);
  } finally {
    await deleteAccount(email);
  }
});
