import { randomUUID } from "node:crypto";

import { type Page } from "@playwright/test";
import { createDatabase } from "@v2/db";

export const PASSWORD = "e2e-password-123";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:54322/agentic_whiteboard_v2";

/** One query against the database the web server uses, for state a UI cannot set yet. */
export async function queryDb<Row extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<Row[]> {
  // The connection belongs to `@v2/db`, the one package allowed to name a
  // database client; the test only runs SQL through it.
  const { pool } = createDatabase(DATABASE_URL);

  try {
    const result = await pool.query<Row>(sql, params);
    return result.rows;
  } finally {
    await pool.end();
  }
}

export type E2EPerson = { name: string; email: string; password: string };

/**
 * Signs a fresh person up through the form. Every test gets its own address so
 * a rerun never depends on rows an earlier run left behind.
 */
export async function signUp(page: Page, name = "E2E person"): Promise<E2EPerson> {
  return signUpWith(page, { name, email: `e2e-${randomUUID()}@example.com` });
}

function randomAddress(): string {
  return `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
}

export async function signUpWith(
  page: Page,
  { name, email }: { name: string; email: string },
): Promise<E2EPerson> {
  // Sign-up is rate-limited per address and per IP. A run creates more people
  // than one IP's hourly budget allows, so each browser context presents its
  // own forwarded address — exactly what a real proxy chain would report.
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": randomAddress() });

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  return { name, email, password: PASSWORD };
}

/**
 * The seeded demo workspaces belong to `acct_demo`. Members management is a
 * later slice, so the test joins that account directly and then makes it the
 * session's active account — the two facts a real invitation would produce.
 */
export async function joinDemoAccount(email: string): Promise<void> {
  await queryDb(
    `insert into member (id, organization_id, user_id, role)
       select $1, 'acct_demo', id, 'owner' from "user" where email = $2
     on conflict (organization_id, user_id) do nothing`,
    [randomUUID(), email],
  );
}

export async function setActiveDemoAccount(page: Page): Promise<void> {
  const response = await page.request.post("/api/auth/organization/set-active", {
    data: { organizationId: "acct_demo" },
    // better-auth checks the origin of a state-changing auth call; a request
    // made by the test context does not carry one unless it is set here.
    headers: { origin: new URL(page.url()).origin },
  });

  if (!response.ok()) {
    throw new Error(`set-active failed with ${response.status()}: ${await response.text()}`);
  }
}

/** Signs up, joins the seeded account, and leaves the session acting in it. */
export async function enterDemoWorkspace(page: Page): Promise<E2EPerson> {
  const person = await signUp(page);
  await joinDemoAccount(person.email);
  await setActiveDemoAccount(page);
  return person;
}
