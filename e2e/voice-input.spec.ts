import { expect, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * Dictation in the dashboard composer. A real recogniser needs a microphone and
 * the browser vendor's speech service, so each spec installs a fake
 * `SpeechRecognition` before the app loads and feeds it results the way Chrome
 * does: interim phrases first, then the same phrase as final.
 */

type FakePhrase = { transcript: string; isFinal: boolean };

type DictationScope = {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  __dictation?: FakeRecognition;
  __emitDictation?: (resultIndex: number, phrases: FakePhrase[]) => void;
};

type FakeRecognition = {
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
};

async function installFakeRecognition(page: Page) {
  await page.addInitScript(() => {
    const scope = window as unknown as DictationScope;

    class FakeSpeechRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
      onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;

      start() {
        scope.__dictation = this;
        this.onstart?.();
      }

      stop() {
        this.onend?.();
      }

      abort() {
        this.onend?.();
      }
    }

    scope.SpeechRecognition = FakeSpeechRecognition as unknown as SpeechRecognitionConstructor;

    scope.__emitDictation = (resultIndex, phrases) => {
      const results = phrases.map((phrase) => ({
        0: { transcript: phrase.transcript, confidence: 1 },
        length: 1,
        isFinal: phrase.isFinal,
      }));

      scope.__dictation?.onresult?.({
        resultIndex,
        results,
      } as unknown as SpeechRecognitionEvent);
    };
  });
}

/** Feeds the fake recogniser a batch of results, like a real `onresult`. */
async function dictate(page: Page, resultIndex: number, phrases: FakePhrase[]) {
  await page.evaluate(
    ({ resultIndex: index, phrases: emitted }) => {
      (window as unknown as DictationScope).__emitDictation?.(index, emitted);
    },
    { resultIndex, phrases },
  );
}

/**
 * The browser sees the reply before the route has stored it and closed the
 * prompt. Deleting the account during that write cascades the prompt away under
 * the assistant message, so wait briefly for the turn to land.
 */
async function deleteAccount(email: string) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const { rows } = await db.query<{ total: number }>(
        `select count(*)::int as total from "agentPrompt"
          where "userId" = (select id from "user" where email = $1)
            and status in ('QUEUED', 'RUNNING')`,
        [email],
      );

      if ((rows[0]?.total ?? 0) === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await db.query('delete from "user" where email = $1', [email]).catch(() => undefined);
  } finally {
    await db.end();
  }
}

async function signUp(page: Page, email: string, password: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Dictation Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}

test("dictation is spliced in at the caret and stays editable", async ({ page }) => {
  await installFakeRecognition(page);

  const id = randomUUID().slice(0, 8);
  const email = `e2e-voice-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const composer = page.getByRole("textbox", { name: "Prompt" });
    const startMic = page.getByRole("button", { name: "Start voice input" });
    const stopMic = page.getByRole("button", { name: "Stop voice input" });

    await composer.fill("Design the API");
    // The words must land where the caret was, not at the end of the draft.
    await composer.evaluate((field: HTMLTextAreaElement) => field.setSelectionRange(7, 7));

    await startMic.click();
    // The button announces itself as a toggle, so the name changes with state.
    await expect(stopMic).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/Listening… speak your prompt/)).toBeVisible();

    // A phrase in flight is previewed in place.
    await dictate(page, 0, [{ transcript: "a REST", isFinal: false }]);
    await expect(composer).toHaveValue("Design a REST the API");

    // Its final text replaces the preview instead of being appended again. The
    // results list is cumulative, as the browser's is, and `resultIndex` points
    // at the phrase that just settled.
    await dictate(page, 0, [{ transcript: "a REST", isFinal: true }]);
    await dictate(page, 1, [
      { transcript: "a REST", isFinal: true },
      { transcript: "for the schema", isFinal: false },
    ]);
    await expect(composer).toHaveValue("Design a REST for the schema the API");

    // Stopping commits the words: the session's caret sits after them, and
    // nothing was sent by itself.
    await stopMic.click();
    await expect(startMic).toHaveAttribute("aria-pressed", "false");
    await expect(composer).toHaveValue("Design a REST for the schema the API");
    await expect(page.getByRole("list", { name: "Agent conversation" })).toHaveCount(0);

    const caret = await composer.evaluate((field: HTMLTextAreaElement) => field.selectionStart);
    expect(caret).toBe("Design a REST for the schema".length);

    // The dictated prompt is ordinary text: Enter sends it.
    await composer.press("Enter");
    await expect(page.getByRole("list", { name: "Agent conversation" })).toContainText(
      "Stub agent: Design a REST for the schema the API",
    );
    await expect(composer).toHaveValue("");
  } finally {
    await deleteAccount(email);
  }
});

test("a browser without the Web Speech API keeps a disabled microphone with the reason", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const scope = window as unknown as DictationScope;
    delete scope.SpeechRecognition;
    delete scope.webkitSpeechRecognition;
  });

  const id = randomUUID().slice(0, 8);
  const email = `e2e-voice-unsupported-${id}@example.com`;

  try {
    await signUp(page, email, `e2e-pass-${id}`);

    const mic = page.getByRole("button", { name: "Start voice input" });
    await expect(mic).toBeVisible();
    await expect(mic).toBeDisabled();
    await expect(
      page.getByText(
        "Voice input needs a browser with speech recognition, such as Chrome or Safari",
      ),
    ).toBeVisible();
  } finally {
    await deleteAccount(email);
  }
});
