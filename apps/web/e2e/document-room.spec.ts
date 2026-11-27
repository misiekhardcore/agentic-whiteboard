import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const modifier = process.platform === "darwin" ? "Meta" : "Control";

async function openDocument(page: Page, workspaceId: string) {
  await page.goto(`/w/${workspaceId}`);
  await expect(page.locator(".doc-status")).toHaveText("Live", { timeout: 30_000 });

  const editor = page.locator(".ProseMirror");
  await expect(editor).toBeVisible();
  return editor;
}

test("two tabs edit the same document and a reload restores it", async ({ context }) => {
  const first = await context.newPage();
  const editor = await openDocument(first, "ws_demo");
  await expect(editor).toHaveAttribute("contenteditable", "true");

  // Start from empty so the assertion can only pass with this test's text.
  await editor.click();
  await first.keyboard.press(`${modifier}+a`);
  await first.keyboard.press("Backspace");

  const stamp = `E2E ${Date.now()}`;
  await first.keyboard.type(stamp);
  await expect(editor).toContainText(stamp);

  const second = await context.newPage();
  const secondEditor = await openDocument(second, "ws_demo");
  await expect(secondEditor).toContainText(stamp);

  await secondEditor.click();
  await second.keyboard.press(`${modifier}+End`);
  await second.keyboard.type(" plus a second tab");
  await expect(editor).toContainText("plus a second tab");

  await first.reload();
  await expect(first.locator(".doc-status")).toHaveText("Live", { timeout: 30_000 });
  await expect(first.locator(".ProseMirror")).toContainText("plus a second tab");
});

test("an archived workspace is read-only in the editor and toolbar", async ({ page }) => {
  await page.goto("/w/ws_demo_archived");

  await expect(page.getByRole("alert")).toContainText("This workspace is archived");
  await expect(page.locator(".doc-status")).toHaveText("Read-only — this workspace is archived");

  const toolbar = page.getByRole("toolbar", { name: "Formatting" });
  await expect(toolbar).toHaveAttribute("aria-disabled", "true");
  for (const name of ["Bold", "Italic", "Strike", "Heading", "Bullets", "Numbers", "Quote"]) {
    await expect(toolbar.getByRole("button", { name })).toBeDisabled();
  }

  const editor = page.locator(".ProseMirror");
  await expect(editor).toHaveAttribute("contenteditable", "false");

  const before = await editor.innerText();
  await editor.click({ force: true });
  await page.keyboard.type("not allowed");
  await expect(editor).toHaveText(before);
});

test("a failed token request leaves the rest of the workspace usable", async ({ page }) => {
  await page.route("**/api/doc/**/token", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "document service unavailable" }),
    }),
  );

  await page.goto("/w/ws_demo");

  await expect(page.getByRole("heading", { name: "Demo workspace" })).toBeVisible();
  await expect(page.getByTestId("doc-notice")).toContainText("The document is unavailable");
  await expect(page.getByText("Read-only path:")).toBeVisible();
});
