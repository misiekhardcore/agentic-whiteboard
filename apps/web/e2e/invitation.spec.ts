import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { enterDemoWorkspace, queryDb, signUpWith } from "./support";

test("the invited person joins once and a second acceptance is refused", async ({
  page,
  browser,
}) => {
  const inviter = await enterDemoWorkspace(page);
  const inviteeEmail = `invitee-${randomUUID()}@example.com`;
  const invitationId = `inv_e2e_${randomUUID()}`;

  await queryDb(
    `insert into invitation (id, organization_id, email, role, status, expires_at, inviter_id)
       select $1, 'acct_demo', $2, 'admin', 'pending', now() + interval '1 day', id
         from "user" where email = $3`,
    [invitationId, inviteeEmail, inviter.email],
  );

  const inviteeContext = await browser.newContext();
  const inviteePage = await inviteeContext.newPage();

  try {
    await signUpWith(inviteePage, { name: "Invitee", email: inviteeEmail });
    await inviteePage.goto(`/invite/${invitationId}`);

    await expect(inviteePage.getByText("Join Demo account")).toBeVisible();
    await expect(inviteePage.getByText(/to join as admin/)).toBeVisible();
    await expect(inviteePage.getByText(/E2E person invited/)).toBeVisible();

    await inviteePage.getByRole("button", { name: "Accept invitation" }).click();
    await inviteePage.waitForURL((url) => url.pathname === "/");

    const members = await queryDb<{ role: string }>(
      `select m.role from member m
         join "user" u on u.id = m.user_id
        where u.email = $1 and m.organization_id = 'acct_demo'`,
      [inviteeEmail],
    );
    expect(members.map((member) => member.role)).toEqual(["admin"]);

    await inviteePage.goto(`/invite/${invitationId}`);
    await expect(inviteePage.getByText("This invitation is no longer pending.")).toBeVisible();
    await expect(inviteePage.getByRole("button", { name: "Accept invitation" })).toHaveCount(0);
  } finally {
    await inviteeContext.close();
  }
});
