import { expect, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * Read aloud in the dashboard composer. A real synthesizer needs an audio
 * device and voices the headless browser does not have, so each spec installs a
 * fake `speechSynthesis` before the app loads and records every utterance it is
 * handed. The scripted provider streams a word per chunk, so a reply is still
 * arriving when its first sentence is spoken.
 */

type SpokenUtterance = { text: string; at: number };

type SpeechScope = {
  __spoken?: SpokenUtterance[];
  __cancelled?: number;
};

async function installFakeSynthesis(page: Page) {
  await page.addInitScript(() => {
    const scope = window as unknown as SpeechScope;
    scope.__spoken = [];
    scope.__cancelled = 0;

    class FakeUtterance {
      text: string;
      lang = "";
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }

    const synthesis = {
      speaking: false,
      pending: false,
      speak(utterance: FakeUtterance) {
        scope.__spoken?.push({ text: utterance.text, at: Date.now() });
        utterance.onstart?.();
        window.setTimeout(() => utterance.onend?.(), 0);
      },
      cancel() {
        scope.__cancelled = (scope.__cancelled ?? 0) + 1;
      },
      pause() {},
      resume() {},
      getVoices() {
        return [];
      },
    };

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: synthesis,
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: FakeUtterance,
    });
  });
}

async function spoken(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as SpeechScope).__spoken?.map((item) => item.text) ?? [],
  );
}

async function cancelled(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as SpeechScope).__cancelled ?? 0);
}

async function deleteAccount(email: string) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('delete from "user" where email = $1', [email]).catch(() => undefined);
  } finally {
    await db.end();
  }
}

/**
 * A turn is not over when its text is on screen: the route still stores the
 * reply and closes the prompt. Removing the account before that finishes would
 * delete the prompt row the assistant message is about to reference.
 */
async function openPrompts(email: string): Promise<number> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const { rows } = await db.query<{ total: number }>(
      `select count(*)::int as total from "agentPrompt"
        where "userId" = (select id from "user" where email = $1)
          and status in ('QUEUED', 'RUNNING')`,
      [email],
    );

    return rows[0]?.total ?? 0;
  } finally {
    await db.end();
  }
}

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Read Aloud Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

test("read aloud speaks each sentence as it streams and survives a reload", async ({ page }) => {
  await installFakeSynthesis(page);

  const id = randomUUID().slice(0, 8);
  const email = `e2e-read-aloud-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const turnOn = page.getByRole("button", { name: "Turn on read aloud" });
    await expect(turnOn).toHaveAttribute("aria-pressed", "false");

    await turnOn.click();
    const turnOff = page.getByRole("button", { name: "Turn off read aloud" });
    await expect(turnOff).toHaveAttribute("aria-pressed", "true");

    const composer = page.getByRole("textbox", { name: "Prompt" });
    await composer.fill(
      "Plan the schema. Then write the migration and run the whole test suite before shipping.",
    );
    await composer.press("Enter");

    // The first sentence is spoken while the rest is still arriving: the stop
    // button is on screen only until the turn ends.
    await expect.poll(() => spoken(page)).toEqual(["Stub agent: Plan the schema."]);
    await expect(page.getByRole("button", { name: "Stop prompt" })).toBeVisible();

    // The rest is spoken as one more sentence, and nothing is read twice.
    await expect
      .poll(() => spoken(page))
      .toEqual([
        "Stub agent: Plan the schema.",
        "Then write the migration and run the whole test suite before shipping.",
      ]);
    await expect(page.getByRole("list", { name: "Agent conversation" })).toContainText(
      "before shipping.",
    );
    await expect.poll(() => openPrompts(email)).toBe(0);

    // The choice is stored with the person, so a reload keeps it; the stored
    // thread is history and is not read back.
    await page.reload();
    await expect(page.getByRole("button", { name: "Turn off read aloud" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await spoken(page)).toEqual([]);
  } finally {
    await deleteAccount(email);
  }
});

test("the settings page changes the preference the composer follows", async ({ page }) => {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-read-aloud-settings-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    await page.goto("/dashboard/settings");
    const toggle = page.getByRole("switch", { name: "Read agent replies aloud" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    // Waiting for the confirmation also waits for the save, so the navigation
    // below cannot cancel the request in flight.
    await expect(page.getByRole("status")).toHaveText("Saved. Read aloud is on.");

    // The composer reads the same stored choice.
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Turn off read aloud" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // And turning it back off there is what the composer starts with.
    await page.goto("/dashboard/settings");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("status")).toHaveText("Saved. Read aloud is off.");

    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Turn on read aloud" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  } finally {
    await deleteAccount(email);
  }
});

test("read aloud is off by default, and turning it off silences the queue", async ({ page }) => {
  await installFakeSynthesis(page);

  const id = randomUUID().slice(0, 8);
  const email = `e2e-read-aloud-off-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    await composer.fill("Plan the schema");
    await composer.press("Enter");

    const thread = page.getByRole("list", { name: "Agent conversation" });
    await expect(thread).toContainText("Stub agent: Plan the schema");
    expect(await spoken(page)).toEqual([]);

    await page.getByRole("button", { name: "Turn on read aloud" }).click();
    await composer.fill("Plan the schema. Then ship it.");
    await composer.press("Enter");

    // The first sentence is read as it arrives. How many of the following ones
    // are heard depends on how quickly the click below lands, so the count is
    // not asserted; what matters is that turning the speaker off cancels the
    // queue, and that what is read afterwards changes.
    await expect.poll(async () => (await spoken(page))[0]).toBe("Stub agent: Plan the schema.");
    await page.getByRole("button", { name: "Turn off read aloud" }).click();
    expect(await cancelled(page)).toBeGreaterThan(0);

    // A reply after the toggle is off is not read.
    await composer.fill("Plan the schema once more");
    await composer.press("Enter");
    await expect(thread).toContainText("Stub agent: Plan the schema once more");
    await expect.poll(() => openPrompts(email)).toBe(0);
    expect(await spoken(page)).not.toContainEqual(expect.stringContaining("once more"));
  } finally {
    await deleteAccount(email);
  }
});
