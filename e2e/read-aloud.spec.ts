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

type FakeVoice = { name: string; lang: string; default: boolean };

type SpokenUtterance = { text: string; voice: string | null; at: number };

type SpeechScope = {
  __spoken?: SpokenUtterance[];
  __cancelled?: number;
};

/**
 * A voice the browser offers. Nothing is installed by default, which is also
 * what a headless browser reports: every reply then uses the platform default.
 * `endDelayMs` holds a spoken utterance open, so a spec can act while one is
 * still playing; by default each finishes immediately.
 */
async function installFakeSynthesis(page: Page, voices: FakeVoice[] = [], endDelayMs = 0) {
  await page.addInitScript(
    (options: { available: FakeVoice[]; delay: number }) => {
      const scope = window as unknown as SpeechScope;
      scope.__spoken = [];
      scope.__cancelled = 0;

      class FakeUtterance {
        text: string;
        lang = "";
        voice: FakeVoice | null = null;
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
          scope.__spoken?.push({
            text: utterance.text,
            voice: utterance.voice?.name ?? null,
            at: Date.now(),
          });
          utterance.onstart?.();
          window.setTimeout(() => utterance.onend?.(), options.delay);
        },
        cancel() {
          scope.__cancelled = (scope.__cancelled ?? 0) + 1;
        },
        pause() {},
        resume() {},
        getVoices() {
          return options.available;
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
    },
    { available: voices, delay: endDelayMs },
  );
}

async function spoken(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as SpeechScope).__spoken?.map((item) => item.text) ?? [],
  );
}

async function spokenVoices(page: Page): Promise<(string | null)[]> {
  return page.evaluate(
    () => (window as unknown as SpeechScope).__spoken?.map((item) => item.voice) ?? [],
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

test("a reply can be read again from its own speaker", async ({ page }) => {
  await installFakeSynthesis(page);

  const id = randomUUID().slice(0, 8);
  const email = `e2e-read-aloud-replay-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    await composer.fill("Plan the schema. Then ship it.");
    await composer.press("Enter");

    const thread = page.getByRole("list", { name: "Agent conversation" });
    await expect(thread).toContainText("Stub agent: Plan the schema");
    // The preference is off, so nothing was read while the reply streamed.
    expect(await spoken(page)).toEqual([]);

    // A reply that is still arriving cannot be read again yet, because that
    // would take over the queue from the live reading it is not getting. The
    // speaker appears once the turn is over.
    const replay = page.getByRole("button", { name: "Read this reply aloud" });
    await expect(replay).toBeVisible();

    // The card's own speaker reads the stored reply from the top, one sentence
    // at a time, without the preference being on.
    await replay.click();
    await expect
      .poll(() => spoken(page))
      .toEqual(["Stub agent: Plan the schema.", "Then ship it."]);
    await expect.poll(() => openPrompts(email)).toBe(0);
  } finally {
    await deleteAccount(email);
  }
});

test("a reply's speaker stops it instead of starting it again", async ({ page }) => {
  // Holding each utterance open keeps the reply being read long enough to press
  // Stop on the card it belongs to.
  await installFakeSynthesis(page, [], 5000);

  const id = randomUUID().slice(0, 8);
  const email = `e2e-read-aloud-stop-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    await composer.fill("Plan the schema. Then ship it.");
    await composer.press("Enter");

    const replay = page.getByRole("button", { name: "Read this reply aloud" });
    await expect(replay).toBeVisible();
    await replay.click();
    await expect(page.getByRole("button", { name: "Stop reading this reply" })).toBeVisible();
    const queued = await spoken(page);
    expect(queued).toEqual(["Stub agent: Plan the schema.", "Then ship it."]);

    await page.getByRole("button", { name: "Stop reading this reply" }).click();
    // Stopping must not re-queue the reply: the label returns to Read, and
    // nothing new was handed to the synthesizer.
    await expect(page.getByRole("button", { name: "Read this reply aloud" })).toBeVisible();
    expect(await spoken(page)).toEqual(queued);
  } finally {
    await deleteAccount(email);
  }
});

test("the voice chosen in settings is the one that reads replies", async ({ page }) => {
  await installFakeSynthesis(page, [
    { name: "Test Male", lang: "en-GB", default: false },
    { name: "Test Female", lang: "en-US", default: true },
  ]);

  const id = randomUUID().slice(0, 8);
  const email = `e2e-read-aloud-voice-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    await page.goto("/dashboard/settings");
    const picker = page.getByLabel("Voice");
    // Nothing chosen yet means the browser's own default.
    await expect(picker).toHaveValue("");
    await picker.selectOption("Test Male");
    await expect(page.getByRole("status")).toHaveText("Saved. Replies will be read in Test Male.");

    // The choice follows the person to the next page load.
    await page.reload();
    await expect(page.getByLabel("Voice")).toHaveValue("Test Male");

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Turn on read aloud" }).click();

    const composer = page.getByRole("textbox", { name: "Prompt" });
    await composer.fill("Plan the schema");
    await composer.press("Enter");

    await expect.poll(() => spoken(page)).not.toHaveLength(0);
    expect(await spokenVoices(page)).toContain("Test Male");
    // The platform default is only a fallback, not what an explicit choice means.
    expect(await spokenVoices(page)).not.toContain("Test Female");
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
