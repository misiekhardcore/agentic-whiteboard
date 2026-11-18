# Ubiquitous Language

Status: living document
Date: 2026-11-18

The words we use to talk about this product. One word, one meaning, and one
context that owns it. The same words appear in the interface, in the agent's
instructions, in the architecture record and in the code.

This is a vocabulary, not a specification and not a data dictionary. A
definition says what a word means and which rule it carries; the rule itself
lives in the code of the owning context. Module, layer, field and protocol names
are how we build, not how we talk about the domain, and they belong to
[docs/architecture](docs/architecture/module-boundaries.md). The vocabulary of
operations — a capability, its callers, its refusal — is defined in
[docs/architecture/capabilities.md](docs/architecture/capabilities.md).

Add a term here before using it in code, and refine the definition when the
understanding changes. Two words for one concept, or one word with two meanings,
is a defect.

## Identity and tenancy

| Term             | Definition                                                                                                                                                 | Owner          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| person           | A signed-in human, the row the schema calls `user`. The agent acts on a person's behalf but is never that person.                                          | `lib/identity` |
| account          | The tenancy and paying scope a request acts in: an organization, or the person's own. Read from the session, never from a body, a form field or the model. | `lib/identity` |
| personal account | The account when no organization is active. Its id is the person's, and it holds the workspaces they created outside any organization.                     | `lib/identity` |
| active account   | The account the session is acting as. Switching it changes the session only; no row moves between accounts.                                                | `lib/identity` |

## Organizations

| Term              | Definition                                                                                                         | Owner               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------- |
| organization      | The shared account: members, invitations, a slug and at most one subscription.                                     | `lib/organizations` |
| member            | A person's membership in one organization, with a role.                                                            | `lib/organizations` |
| role              | `owner`, `admin` or `member`. Owners and admins invite, remove, change roles and pay; nobody edits their own role. | `lib/organizations` |
| invitation        | A time-limited offer to an email address to join with a role. The emailed link states a 48 hour expiry.            | `lib/organizations` |
| organization slug | The unique, URL-safe name: lowercase letters, digits and single hyphens, at most 40 characters.                    | `lib/organizations` |
| seat              | One member counted on a per-member plan; accepting an invitation or removing a member re-syncs the count.          | `lib/billing`       |

## Workspace

| Term             | Definition                                                                                                                                            | Owner           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| workspace        | The unit of work in an account: a name, a description, a status, at most one document, at most one canvas, and its agent history.                     | `lib/workspace` |
| workspace status | Where the work stands: `PLANNING`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`. Archiving is not a status; an archived workspace keeps the one it had.         | `lib/workspace` |
| workspace access | A workspace and the person's relationship to it: personal or organization, the organization, and their role there.                                    | `lib/workspace` |
| archive          | The reversible removal: hides a workspace from the dashboard, frees its plan slot, and keeps its content and history for a restore.                   | `lib/workspace` |
| restore          | Clearing the archive, undoing the person's own archive. The agent may restore.                                                                        | `lib/workspace` |
| delete           | Permanent removal of an archived workspace and everything under it. Only an archived workspace can be deleted, so one request cannot erase live work. | `lib/workspace` |
| workspace limit  | The number of non-archived workspaces an account may hold on a plan, checked under a lock so two creates cannot take the last slot.                   | `lib/workspace` |

## Content surfaces

| Term            | Definition                                                                                                                                              | Owner                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| content surface | One of a workspace's two content containers, `doc` or `canvas`. At most one of each, and neither has a name, status or description of its own.          | `lib/doc`, `lib/canvas` |
| document        | The workspace's text surface. Its Yjs state is authoritative and the stored content is that state's projection.                                         | `lib/doc`               |
| canvas          | The workspace's shapes surface.                                                                                                                         | `lib/canvas`            |
| snapshot        | A read-only view of a live surface: workspace, surface, revision marker, content. Never raw Yjs bytes.                                                  | `lib/collab`            |
| mutation        | One semantic intent such as adding a shape, applied in a single Yjs transaction. Never a whole-document replacement, so concurrent human edits survive. | `lib/collab`            |

## Billing and plans

| Term            | Definition                                                                                                                                                                                 | Owner         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| plan            | A catalog entry: name, price, audience, features and limits. `team` is the name of a plan, never a second word for an organization.                                                        | `lib/billing` |
| plan limit      | A counted number a plan allows, where unlimited is spelled `null`: workspaces, and agent prompts per month.                                                                                | `lib/billing` |
| plan capability | A feature a plan switches on: live collaboration, voice input, share links, PDF export.                                                                                                    | `lib/billing` |
| entitlements    | What an account may do right now, resolved from its plan and subscription, and the free entitlements when there is no paid one.                                                            | `lib/billing` |
| subscription    | Our mirror of one Stripe subscription, one row per billing owner. Active, trialing and past due grant the plan; a canceled one keeps its row.                                              | `lib/billing` |
| billing owner   | Who pays: a person or an organization, by that owner's id.                                                                                                                                 | `lib/billing` |
| usage window    | The period a count belongs to: a subscriber's Stripe period, otherwise the UTC calendar month.                                                                                             | `lib/billing` |
| allowance       | The per-member prompt quota inside the paying account. It counts prompts created in the window, skips branched copies and still counts superseded ones; a refused request is not a prompt. | `lib/ai`      |
| plan change     | Repricing the existing subscription instead of opening a second one, prorated onto the next invoice.                                                                                       | `lib/billing` |

## Agent thread

| Term         | Definition                                                                                                                                                                                                                                                                                                    | Owner    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| agent        | The model participant. It acts as its own actor on behalf of the requester and never chooses the person, account or workspace it writes to.                                                                                                                                                                   | `lib/ai` |
| prompt       | One accepted request to the agent: the billing unit and the execution unit in one row, from queued through running and awaiting approval to completed, failed or cancelled. A refused request records nothing. The architecture records still call this execution a run; it is this row, not a second record. | `lib/ai` |
| turn         | A prompt together with the messages it produced, as the thread reads it. The tip is a conversation's newest live prompt, and only a failed tip can be retried.                                                                                                                                                | `lib/ai` |
| conversation | The stored container a person's prompts belong to, chosen before the first prompt and kept in the URL. A conversation with no workspace is a dashboard conversation.                                                                                                                                          | `lib/ai` |
| thread       | The live messages of one conversation, with superseded prompts filtered out. A view over stored rows, never a table of its own.                                                                                                                                                                               | `lib/ai` |
| message      | One stored chat row: system, user or assistant. Tool calls and results are parts of an assistant message, so there is no tool role.                                                                                                                                                                           | `lib/ai` |
| approval     | A tool call parked for a person's decision, which also parks its prompt, stays answerable for 24 hours, and is matched back inside that person's own thread.                                                                                                                                                  | `lib/ai` |
| superseded   | Marked, never deleted, on a prompt or a message: invisible to the thread and the model, still counted by the allowance, still readable to an operator.                                                                                                                                                        | `lib/ai` |
| retry        | Re-running a conversation's newest prompt when it failed and its text is unchanged. The row is reused, so a broken turn is not charged twice.                                                                                                                                                                 | `lib/ai` |
| rewind       | An edited or re-sent prompt that replaces the branch point and everything after it. The new prompt is counted; the replaced turns are superseded.                                                                                                                                                             | `lib/ai` |
| branch       | A new conversation holding a copy of another's live turns through a chosen reply. Copies are history: they are skipped by the allowance, and only a finished turn can be branched.                                                                                                                            | `lib/ai` |

## Distinctions that carry rules

- **Person, account, organization.** A person is a human. An account is the
  tenancy and paying scope. An organization is the shared account; the personal
  account is the other kind of account.
- **Prompt, turn, message.** A prompt is one accepted request and one billed
  unit. A turn is that prompt with the messages it produced, as the person reads
  it. A message is one stored chat row.
- **Conversation, thread.** A conversation is a stored container. A thread is
  the live view of its messages; there is no thread row to write.
- **Archive, restore, delete.** Archive is reversible and frees the plan slot.
  Restore undoes it. Delete is permanent, and only possible after archiving.
- **Plan, subscription, entitlements.** The plan is catalog data, the
  subscription is mirrored Stripe state, and the entitlements are what the
  account may do once both resolve.
- **Status, stage.** One value: coded and stored as `status`, labelled "stage"
  where people see it as a column.
