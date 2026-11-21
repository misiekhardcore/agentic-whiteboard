# Conversations belong to an account

Status: accepted
Date: 2026-11-21

Supersedes the "conversation list is per person, not per account" consequence of
[agent-conversations](agent-conversations.md); the turn, retry, rewind and branch
decisions there still hold.

## Context

A conversation was owned by a person and by nobody else. The schema said
`userId`, every read filtered by it, and the dashboard listed every thread that
person had ever opened. Meanwhile prompts were already charged to the **active
account** (`agentPrompt.ownerId`, an organization id or the person's own), read
from the session, not from the request.

So the two halves disagreed: a member who switched from a personal account to an
organization saw the same five recent conversations, and a thread written while
an organization paid looked like it belonged to the person. Splitting work
between "my own planning" and "this team's planning" was impossible without
inventing a naming convention.

## Decisions

| Area         | Decision                                                                                                                         | Why                                                                                                                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account      | A nullable `organizationId` on `agentConversation` and on `agentPrompt`                                                          | One column names the account the way every other row in the schema does (`workspace.orgId`): the organization that paid, or null for the person. No second column has to agree with it, and the old `ownerId` string stops conflating a user id and an organization id. |
| Member       | `userId` stays, and every read keeps it                                                                                          | The conversation belongs to a person _inside_ an account: an organization's threads are per member, never shared, so `organizationId` is an additional filter, not a replacement.                                                                                       |
| Read context | `ConversationOwner` is `{ userId, organizationId }`, and every query composes one `conversationOwnerConditions` predicate        | Both fields are required, so a caller cannot leave the account behind; one predicate means a new query cannot spell the scope differently from the others. A null organization is `is null` because `= null` matches nothing, and the predicate owns that choice.       |
| Write guard  | `openDashboardPrompt` reuses that predicate and refuses a conversation filed elsewhere                                           | The row and its first prompt are created in one transaction, so the account the prompt is paid by and the account the thread is filed under are decided together.                                                                                                       |
| Reads        | Every read filters by the owner: switcher, thread, history dialog, live-turn lookup, parked prompt, retry, branch source, titles | An id from another account's conversation must select nothing. Filtering in the query, not in the page, is what makes that true for every caller instead of the careful ones.                                                                                           |
| Latest       | The "latest conversation" fallback and the requested-id check both resolve inside the active account                             | Switching accounts must change the set. A named id belonging to the account the person just left is not theirs to open here, so it is replaced rather than answered.                                                                                                    |
| Branches     | A branch inherits the source conversation's account                                                                              | A branch continues a thread; filing it elsewhere would silently move history into another account.                                                                                                                                                                      |
| Allowance    | Unchanged: the paying account still comes from the session, counted per `(organizationId, userId)`                               | The account partition decides visibility, not who pays. Retry, approval resume and branched copies keep their existing treatment.                                                                                                                                       |
| Migration    | One migration: add `organizationId`, convert `agentPrompt.ownerId` into it, drop the old column                                  | `ownerId` held the organization's id or the person's own, so the backfill copies the first and turns the second into null; conversations predate accounts, so they were personal and keep their history. Nothing moves between accounts.                                |

The rejected alternative was to record a kind (`PERSONAL`/`ORGANIZATION`) next to
a polymorphic id. It needs two columns and an enum to say what one nullable column
says, and every new table would have to learn the same tuple.

## Consequences

- Switching the active account switches the conversation set, and switching back
  restores the first one: the two lists are disjoint by construction.
- A teammate never sees another member's conversation, because `userId` is still
  part of every predicate; being in the same organization does not share history.
- A conversation id from another account resolves to nothing, so the URL cannot
  be used to read a thread the active account does not hold.
- An organization id is not a foreign key, so a deleted organization leaves its
  rows behind rather than cascading. Nothing reads them: no session can select a
  deleted organization as its account.
- Prompt ownership, the per-member allowance and the branch replay rule are
  untouched: this slice changes where a conversation lives, not what a prompt
  costs.

## Deferred

- Sharing a conversation with the account's other members.
- Moving a conversation between accounts.
- An organization-wide conversation list for owners and admins.
- Member-scoped profiles (a title per organization). When they arrive they belong
  on `member` and are read by joining `(organizationId, userId)`; a conversation
  keeps referencing the person, not the membership row.
