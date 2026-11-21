import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

/**
 * The tags a crawler or a social card reads are only guaranteed by the response
 * the app actually sends, so these assertions run against a real page rather
 * than the metadata objects alone.
 */
test("the landing page publishes its metadata", async ({ page, baseURL }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/WorkspAIce/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /infinite canvas/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", baseURL ?? "");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
    "content",
    "WorkspAIce",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /opengraph-image/,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest/);
  expect(await page.locator('link[rel="icon"]').count()).toBeGreaterThan(0);

  const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
  expect(structuredData).toContain("SoftwareApplication");
  const parsed: unknown = JSON.parse(structuredData ?? "{}");
  expect(parsed).not.toBeNull();
});

test("robots, sitemap, manifest and icons are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const robotsBody = await robots.text();
  expect(robotsBody).toContain("Disallow: /dashboard/");
  expect(robotsBody).toContain("Sitemap:");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const sitemapBody = await sitemap.text();
  expect(sitemapBody).toContain("<loc>");
  expect(sitemapBody).not.toContain("/dashboard");

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const webManifest = (await manifest.json()) as {
    name: string;
    start_url: string;
    icons: { src: string }[];
  };
  expect(webManifest).toMatchObject({ name: "WorkspAIce", start_url: "/dashboard" });
  expect(webManifest.icons).toHaveLength(3);

  for (const icon of webManifest.icons) {
    const response = await request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }

  const svgIcon = await request.get("/icon.svg");
  expect(svgIcon.status()).toBe(200);
  expect(svgIcon.headers()["content-type"]).toContain("image/svg+xml");

  const appleIcon = await request.get("/apple-icon.png");
  expect(appleIcon.status()).toBe(200);
  expect(appleIcon.headers()["content-type"]).toBe("image/png");

  const socialCard = await request.get("/opengraph-image");
  expect(socialCard.status()).toBe(200);
  expect(socialCard.headers()["content-type"]).toBe("image/png");
  expect((await socialCard.body()).byteLength).toBeGreaterThan(5_000);
});

test("pre-auth pages and the dashboard stay out of search", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page).toHaveTitle(/Sign in · WorkspAIce/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  // A noindex page that canonically defers to the marketing page contradicts itself.
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);

  const id = randomUUID().slice(0, 8);
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Metadata Tester");
  await page.getByLabel("Email").fill(`e2e-metadata-${id}@example.com`);
  await page.getByLabel("Password").fill(`e2e-pass-${id}`);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");

  await expect(page).toHaveTitle(/Dashboard · WorkspAIce/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});
