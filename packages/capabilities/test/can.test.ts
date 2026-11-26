import type { Actor } from "@v2/contracts";
import { describe, expect, it } from "vitest";

import { can } from "../src";

const person = (accountId: string): Actor => ({
  type: "user",
  userId: "user-1",
  accountId,
});

const agent = (accountId: string): Actor => ({
  type: "agent",
  runId: "run-1",
  accountId,
  requestedByUserId: "user-1",
});

const matrix: {
  name: string;
  actor: Actor;
  action: "workspace.read";
  accountId: string;
  archived: boolean;
  allowed: boolean;
}[] = [
  {
    name: "a person reads a workspace in their account",
    actor: person("account-1"),
    action: "workspace.read",
    accountId: "account-1",
    archived: false,
    allowed: true,
  },
  {
    name: "a person cannot read another account's workspace",
    actor: person("account-2"),
    action: "workspace.read",
    accountId: "account-1",
    archived: false,
    allowed: false,
  },
  {
    name: "an agent reads on behalf of a person in the account",
    actor: agent("account-1"),
    action: "workspace.read",
    accountId: "account-1",
    archived: false,
    allowed: true,
  },
  {
    name: "an agent cannot read another account's workspace",
    actor: agent("account-2"),
    action: "workspace.read",
    accountId: "account-1",
    archived: false,
    allowed: false,
  },
  {
    name: "an archived workspace stays readable",
    actor: person("account-1"),
    action: "workspace.read",
    accountId: "account-1",
    archived: true,
    allowed: true,
  },
];

describe("can", () => {
  it.each(matrix)("$name", ({ actor, action, accountId, archived, allowed }) => {
    expect(can(actor, action, { accountId, archived })).toBe(allowed);
  });
});
