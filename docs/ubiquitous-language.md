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
| person           | A signed-in human, the row the schema calls `user`. The agent acts on a person's behalf but is never that person.                                          | `apps/web` |
| session          | The row that makes a cookie authenticate. It names the person and their active organization; signing out deletes it, so a copied cookie is useless afterwards. The cookie is a lookup key, never a bearer credential. | `apps/web` |
| actor            | Who a capability call acts as: a signed-in person in one account, or the agent on a person's behalf. It is resolved from the session on the server, never read from a body, query or header. | `packages/contracts` |
| account          | The tenancy and paying scope a request acts in: an organization, or the person's own. Read from the session, never from a body, a form field or the model. | `apps/web` |
| personal account | The account when no organization is active. Its id is the person's, and it holds the workspaces they created outside any organization.                     | `apps/web` |
| active account   | The account the session is acting as. Switching it changes the session only; no row moves between accounts.                                                | `apps/web` |
| invitation       | A pending offer to one email address to join an organization with a role. Accepting is the invited person's own act and happens once; a spent or expired invitation is refused. | `apps/web` |

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

| Term             | Definition                                                                                                                                                                                                    | Owner           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| workspace        | The unit of work in an account: a name, a description, a status, at most one document, at most one canvas, and its agent history.                                                                             | `lib/workspace` |
| workspace status | Where the work stands: `PLANNING`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`. Archiving is not a status; an archived workspace keeps the one it had.                                                                 | `lib/workspace` |
| board            | The stage columns on `/workspaces`: every non-archived workspace of the active account, placed by status and ordered inside its column.                                                                       | `lib/workspace` |
| column           | One status on the board. Fixed and always shown, so an empty stage is information rather than absence.                                                                                                        | `lib/workspace` |
| position         | A workspace's place inside its column, ascending. Only a move writes it, and a value means something only relative to its neighbours.                                                                         | `lib/workspace` |
| workspace access | A workspace and the person's relationship to it: personal or organization, the organization, and their role there.                                                                                            | `lib/workspace` |
| archive          | The reversible removal: hides a workspace from the dashboard, frees its plan slot, and keeps its content and history for a restore.                                                                           | `lib/workspace` |
| restore          | Clearing the archive, undoing the person's own archive. The agent may restore.                                                                                                                                | `lib/workspace` |
| delete           | Permanent removal of an archived workspace and everything under it. Only an archived workspace can be deleted, so one request cannot erase live work.                                                         | `lib/workspace` |
| workspace limit  | The number of non-archived workspaces an account may hold on a plan, checked under a lock so two creates cannot take the last slot.                                                                           | `lib/workspace` |
| activity         | One recorded state change of a workspace on one of its surfaces: the kind, the actor, the time and what changed. Append-only.                                                                                 | `lib/workspace` |
| activity kind    | The named change: created, renamed, described, stage moved, archived, restored, doc saved, canvas saved.                                                                                                      | `lib/workspace` |
| actor            | Who performed an activity: a person, or the agent acting on a person's behalf, which records that person as the requester.                                                                                    | `lib/workspace` |
| last activity    | A workspace's newest activity, counting the rows for its document and canvas. What a card shows.                                                                                                              | `lib/workspace` |
| workspace card   | The one rendering of a workspace in a grid: name, description, creator, the timestamp its state shows, and an overflow menu of the operations that state allows. A board card leaves the stage to its column. | `lib/workspace` |

## Content surfaces

| Term            | Definition                                                                                                                                              | Owner           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| content surface | One of a workspace's two content containers, `doc` or `canvas`. At most one of each, and neither has a name, status or description of its own.          | `lib/workspace` |
| document        | The workspace's text surface. Its Yjs state is authoritative and the stored content is that state's projection.                                         | `lib/collab`    |
| canvas          | The workspace's shapes surface.                                                                                                                         | `lib/collab`    |
| snapshot        | A read-only view of a live surface: workspace, surface, revision marker, content. Never raw Yjs bytes.                                                  | `lib/collab`    |
| mutation        | One semantic intent such as adding a shape, applied in a single Yjs transaction. Never a whole-document replacement, so concurrent human edits survive. | `lib/collab`    |
| block           | One top-level unit of a document, addressed by a stable identity that survives edits above and below it. Operations name a block id, never an offset. | `apps/collab`   |
| operation key   | The request key — one string, which an agent composes from its run id and operation key (`runId_opKey`) and a person sends as a request id — recorded inside the document with the blocks it wrote. A replay applies nothing and returns the current revision. | `apps/collab`   |
| revision        | The document's own content revision: advanced once per quiet period of content changes, and immediately on a save, stored with the Yjs state. Compare it; do not parse it as a row count. | `apps/collab`   |
| save            | Writing the room's current Yjs state to its snapshot now, counting any change the revision debounce has not counted yet. The revision the save answers is already durable. | `apps/collab`   |

## Media

| Term          | Definition                                                                                                                                                                               | Owner       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| media         | A stored file: its row in Postgres plus its bytes in object storage. Scoped to the account it was uploaded into, which is what decides who may read it; only its uploader may delete it. | `lib/media` |
| media account | The organization a media row belongs to, taken from the board the file was uploaded from. A null account is the uploader's own file.                                                     | `lib/media` |
| storage key   | The name a media object is stored under in the bucket. Never shown to a browser; a reader asks the app for the file by its media id instead.                                             | `lib/media` |

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

| Term               | Definition                                                                                                                                                                                                                                                                                                    | Owner    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| agent              | The model participant. It acts as its own actor on behalf of the requester and never chooses the person, account or workspace it writes to.                                                                                                                                                                   | `lib/ai` |
| prompt             | One accepted request to the agent: the billing unit and the execution unit in one row, from queued through running and awaiting approval to completed, failed or cancelled. A refused request records nothing. The architecture records still call this execution a run; it is this row, not a second record. | `lib/ai` |
| turn               | A prompt together with the messages it produced, as the thread reads it. The tip is a conversation's newest live prompt, and only a failed tip can be retried.                                                                                                                                                | `lib/ai` |
| conversation       | The stored container a person's prompts belong to, in one account: personal or organization, and never shared with a teammate. Chosen before the first prompt and kept in the URL.                                                                                                                            | `lib/ai` |
| agent panel        | The resizable right column holding the conversation on every page of the workspaces section. Same conversation as the dashboard composer, not a second one.                                                                                                                                                   | `lib/ai` |
| conversation title | The name a conversation carries: derived from its first prompt when the row is created, then replaced once by a generated one. Never empty, never a route or an id.                                                                                                                                           | `lib/ai` |
| thread             | The live messages of one conversation, with superseded prompts filtered out. A view over stored rows, never a table of its own.                                                                                                                                                                               | `lib/ai` |
| message            | One stored chat row: system, user or assistant. Tool calls and results are parts of an assistant message, so there is no tool role.                                                                                                                                                                           | `lib/ai` |
| approval           | A tool call parked for a person's decision, which also parks its prompt in `AWAITING_APPROVAL`. The browser carries the answer, signed at issuance, and the parked row of that person's conversation decides whether it resumes; the tool call is authorized again when it runs.                              | `lib/ai` |
| superseded         | Marked, never deleted, on a prompt or a message: invisible to the thread and the model, still counted by the allowance, still readable to an operator.                                                                                                                                                        | `lib/ai` |
| retry              | Re-running a conversation's newest prompt when it failed and its text is unchanged. The row is reused, so a broken turn is not charged twice.                                                                                                                                                                 | `lib/ai` |
| rewind             | An edited or re-sent prompt that replaces the branch point and everything after it. The new prompt is counted; the replaced turns are superseded.                                                                                                                                                             | `lib/ai` |
| branch             | A new conversation holding a copy of another's live turns through a chosen reply. Copies are history: they are skipped by the allowance, and only a finished turn can be branched.                                                                                                                            | `lib/ai` |

## Live updates

| Term           | Definition                                                                                                                                                                             | Owner              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| change         | One dataset a successful call changed, named by a key and a scope. Declared by the capability that made the change, published by the kernel, never by the page.                        | `lib/capabilities` |
| change key     | The name of a dataset the interface shows: one of the coarse keys (`workspaces`, `conversations`, `account`, `settings`) or a per-resource key such as `workspace:<id>`.               | `lib/shared`       |
| change scope   | Who may be told: `person` for the caller, `account` for everyone in the active account, which is the caller alone when the account is personal.                                        | `lib/shared`       |
| change topic   | The Realtime channel a change travels on: `app:user:<id>` or `app:org:<id>`. A browser may read only the topics its session owns.                                                      | `lib/shared`       |
| broadcast      | The at-most-once delivery of a change over a private Realtime channel. A hint to re-read, so a lost message costs freshness and never truth.                                           | `lib/capabilities` |
| realtime token | The short-lived JWT the browser shows Realtime, minted from the session and signed with the stack's secret. It carries the person as `sub`, and RLS decides what that person may read. | `lib/identity`     |

## Platform layers

| Term       | Definition                                                                                                                                                                                                                                                                                                | Owner                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| room owner | The one process allowed to hold a content surface's CRDT and to apply writes to it. Everything reads and writes content through `RoomOwnerPort`; no query updates a body. A second instance holding the same room is a defect, not a race to resolve.                                                     | `packages/contracts`   |
| capability | One semantic operation: a name, a description, an effect, the callers it is exposed to, input and output schemas, an `authorize` step that returns the row it authorized, a handler and the datasets it changes. A person's click and an agent's proposal invoke the same record.                        | `packages/capabilities` |
| effect     | `read` or `write`. A read runs during reasoning; a write is collected, gated and committed. The effect decides the approval path, not a separate "risk" flag.                                                                                                                                            | `packages/capabilities` |
| room token | A short-lived claim minted by the app naming the actor, room, account and permission. The room owner verifies it and re-checks membership at apply time, because a run outlives a membership.                                                                                                             | `apps/web`             |
| room lease | The exclusive claim an instance of a room owner holds on one room, with an expiry. A second instance refuses the room and names the holder; an expired lease is the only way to take it over.                                                                                                             | `apps/collab`          |

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
  in the interface, where each value is a board column.
- **Stage move, workspace edit, activity.** A stage move is one kind of activity,
  which also records renames, descriptions, the archive lifecycle and surface
  saves; an activity is the history row, never a live field of the workspace.
- **Board, latest list, archive.** The board shows non-archived workspaces by
  stage and position. The latest list shows the newest workspaces and surfaces.
  The archive shows what was removed from both.
- **Change, broadcast, refresh.** A change is the declared fact that a dataset
  differs. A broadcast is its delivery, which may be missed. A refresh is the
  page reading the data again, which is what makes the change visible.
- **Derived title, generated title.** The derived title is cut from the first
  prompt and exists immediately. The generated title replaces it once, in the
  background, and is what the conversation keeps.
