import { expect, type Frame, type Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import Stripe from "stripe";

/**
 * These tests drive the real app against a real Stripe test-mode account. The
 * checkout test is skipped when the keys are absent (forks, a bare local run);
 * CI provides them as secrets.
 */
const stripeConfigured = Boolean(
  process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
);

/**
 * Opens a plan's checkout sheet. The retry covers the first click landing
 * before React has hydrated the pricing section on a dev server.
 */
async function openPlanSheet(page: Page, plan: string) {
  await expect(async () => {
    await page.getByRole("button", { name: new RegExp(`choose ${plan}`, "i") }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/**
 * Stripe renders the embedded checkout page in its own frame, nested inside the
 * frame the `<EmbeddedCheckout />` element creates. Frame URLs change with each
 * Stripe.js build, so find the frame that actually holds the card field.
 */
async function waitForCardFrame(page: Page): Promise<Frame> {
  let cardFrame: Frame | undefined;

  await expect
    .poll(
      async () => {
        for (const frame of page.frames()) {
          if (!frame.url().includes("/v3/embedded-checkout-inner")) continue;
          if ((await frame.locator('input[name="cardNumber"]').count()) > 0) {
            cardFrame = frame;
            return true;
          }
        }
        return false;
      },
      { timeout: 60_000, intervals: [500] },
    )
    .toBe(true);

  if (!cardFrame) throw new Error("Stripe's card form never appeared");
  return cardFrame;
}

async function findPersonalSubscription(email: string) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{
      plan: string;
      status: string;
      seats: number;
      stripeSubscriptionId: string;
    }>(
      `select s.plan, s.status, s.seats, s."stripeSubscriptionId"
         from subscription s
         join "user" u on u.id = s."ownerId"
        where u.email = $1
          and s."ownerType" = 'USER'
        order by s."createdAt" desc
        limit 1`,
      [email],
    );
    return rows[0] ?? null;
  } finally {
    await client.end();
  }
}

test.describe("pricing", () => {
  test("shows the personal and team plans with the catalog prices", async ({ page }) => {
    await page.goto("/#pricing");

    await expect(page.getByRole("tab", { name: "Personal" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const personal = page.getByRole("tabpanel", { name: "Personal" });
    await expect(personal.getByText("$0")).toBeVisible();
    await expect(personal.getByText("$12", { exact: true })).toBeVisible();
    await expect(personal.getByRole("button", { name: /choose pro/i })).toBeVisible();

    await page.getByRole("tab", { name: "Team" }).click();

    const team = page.getByRole("tabpanel", { name: "Team" });
    await expect(team.getByText("$12", { exact: true })).toBeVisible();
    await expect(team.getByText("$20", { exact: true })).toBeVisible();
    await expect(team.getByRole("button", { name: /choose team/i })).toBeVisible();
    await expect(team.getByRole("button", { name: /choose enterprise/i })).toBeVisible();
  });

  test("buys Pro and mirrors the subscription from Stripe", async ({ page }) => {
    test.skip(!stripeConfigured, "Needs STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");

    const id = randomUUID().slice(0, 8);
    const email = `e2e-billing-${id}@example.com`;
    const password = `e2e-pass-${id}`;

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("E2E Buyer");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/dashboard");

    await page.goto("/#pricing");
    await openPlanSheet(page, "pro");

    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText("Choose Pro");
    await sheet.getByRole("button", { name: /continue to secure checkout/i }).click();

    // This is the payment step a human would type into Stripe's form.
    const cardForm = await waitForCardFrame(page);

    await cardForm.locator('input[name="cardNumber"]').fill("4242 4242 4242 4242");
    await cardForm.locator('input[name="cardExpiry"]').fill("12 / 34");
    await cardForm.locator('input[name="cardCvc"]').fill("123");
    await cardForm.locator('input[name="billingName"]').fill("E2E Buyer");

    const country = cardForm.locator('select[name="billingCountry"]');
    if (await country.count()) {
      await country.selectOption("US");
    }
    const postalCode = cardForm.locator(
      'input[name="billingPostalCode"], input[name="billingZip"]',
    );
    if (await postalCode.count()) {
      await postalCode.first().fill("94107");
    }

    await cardForm.getByRole("button", { name: /pay and subscribe/i }).click();

    await expect(page.getByRole("dialog")).toContainText(/You.re on Pro/, {
      timeout: 90_000,
    });

    // The row is written by the webhook, which `stripe listen` forwards.
    await expect
      .poll(() => findPersonalSubscription(email), {
        timeout: 60_000,
        intervals: [1_000],
      })
      .toMatchObject({ plan: "pro", status: "active", seats: 1 });

    // The account is now on a paid plan, so a second checkout is refused
    // instead of creating a duplicate subscription.
    const secondCheckout = await page.request.post("/api/billing/checkout", {
      data: { planId: "pro" },
    });
    expect(secondCheckout.status()).toBe(409);

    const subscription = await findPersonalSubscription(email);
    if (subscription?.stripeSubscriptionId) {
      await new Stripe(process.env.STRIPE_SECRET_KEY).subscriptions
        .cancel(subscription.stripeSubscriptionId)
        .catch(() => undefined);
    }
  });
});
