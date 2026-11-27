import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import {
  enterDemoWorkspace,
  joinDemoAccount,
  queryDb,
  setActiveDemoAccount,
  signUp,
} from "./support";

test("signing up lands in the new account and survives a reload", async ({ page }) => {
  const person = await signUp(page);

  await expect(page.getByText(`Hello, ${person.name}`)).toBeVisible();
  await expect(page.getByText(person.email)).toBeVisible();

  await page.reload();

  await expect(page.getByText(person.email)).toBeVisible();
});

test("a wrong password and an unknown address answer the same sentence", async ({ page }) => {
  const person = await signUp(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/sign-in");

  async function attempt(email: string) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "Incorrect email or password." });
    await expect(alert).toBeVisible();
    return alert.innerText();
  }

  const wrongPassword = await attempt(person.email);
  const unknownAddress = await attempt(`unknown-${randomUUID()}@example.com`);

  expect(wrongPassword).toContain("Incorrect email or password.");
  expect(unknownAddress).toBe(wrongPassword);
});

test("a signed-out workspace visit returns to that exact route after sign-in", async ({ page }) => {
  const person = await signUp(page);
  await joinDemoAccount(person.email);
  await setActiveDemoAccount(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/sign-in");

  await page.goto("/w/ws_demo?from=e2e");
  await page.waitForURL((url) => url.pathname === "/sign-in");
  expect(new URL(page.url()).searchParams.get("redirectTo")).toBe("/w/ws_demo?from=e2e");

  await page.getByLabel("Email").fill(person.email);
  await page.getByLabel("Password").fill(person.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL(
    (url) => url.pathname === "/w/ws_demo" && url.searchParams.get("from") === "e2e",
  );
});

test("signing out deletes the session row, so an old cookie is unauthenticated", async ({
  page,
  browser,
}) => {
  await signUp(page);
  const oldCookie = await page.context().storageState();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/sign-in");

  const replayed = await browser.newContext({ storageState: oldCookie });
  const replayPage = await replayed.newPage();

  try {
    await replayPage.goto("/");
    await replayPage.waitForURL((url) => url.pathname === "/sign-in");
  } finally {
    await replayed.close();
  }
});

test("a reset link sets a new password and ends the sessions opened before it", async ({
  page,
  browser,
}) => {
  const person = await signUp(page);
  const oldCookie = await page.context().storageState();
  const newPassword = "e2e-new-password-456";

  // The reset happens from a signed-out browser: an auth page is not for a
  // signed-in visitor, and the old session has to stay alive to prove the
  // reset ends it.
  const resetContext = await browser.newContext();
  const resetPage = await resetContext.newPage();

  try {
    await resetPage.goto("/forgot-password");
    await resetPage.getByLabel("Email").fill(person.email);
    await resetPage.getByRole("button", { name: "Send reset link" }).click();
    await expect(resetPage.getByText(/If that address has an account/)).toBeVisible();

    const rows = await queryDb<{ identifier: string }>(
      `select identifier from verification
        where identifier like 'reset-password:%' and expires_at > now()
        order by created_at desc limit 1`,
    );
    const identifier = rows[0]?.identifier;
    if (identifier === undefined) throw new Error("The reset link created no token.");

    await resetPage.goto(
      `/reset-password?token=${encodeURIComponent(identifier.slice("reset-password:".length))}`,
    );
    await resetPage.getByLabel("New password").fill(newPassword);
    await resetPage.getByRole("button", { name: "Set new password" }).click();
    await resetPage.waitForURL((url) => url.pathname === "/sign-in");

    // The session opened before the reset is gone from the database.
    const replayed = await browser.newContext({ storageState: oldCookie });
    const replayPage = await replayed.newPage();
    try {
      await replayPage.goto("/");
      await replayPage.waitForURL((url) => url.pathname === "/sign-in");
    } finally {
      await replayed.close();
    }

    // The new password is the one that works.
    await resetPage.getByLabel("Email").fill(person.email);
    await resetPage.getByLabel("Password").fill(newPassword);
    await resetPage.getByRole("button", { name: "Sign in" }).click();
    await resetPage.waitForURL((url) => url.pathname === "/");
  } finally {
    await resetContext.close();
  }
});

test("a workspace in another account is not found and does not switch the account", async ({
  page,
  browser,
}) => {
  const member = await enterDemoWorkspace(page);
  const outsider = await browser.newContext();
  const outsiderPage = await outsider.newPage();

  try {
    await signUp(outsiderPage, "Outsider");
    await outsiderPage.goto("/w/ws_demo");

    await expect(outsiderPage.getByRole("heading", { name: "Not found" })).toBeVisible();
    await outsiderPage.goto("/");
    // Still the outsider's own personal account; the link did not move them.
    await expect(outsiderPage.getByText("personal account")).toBeVisible();
    expect(member.email).toContain("@example.com");
  } finally {
    await outsider.close();
  }
});
