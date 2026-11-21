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

The obvious shortcut — treat a missing organization id as the personal account —
is exactly the ambiguity the schema must not carry. A read cannot distinguish
"personal" from "the organization was not resolved", and a row cannot say which
account it was written in after the session's active organization changes.

## Decisions

| Area           | Decision                                                                                                                                                    | Why                                                                                                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account record | `agentConversation.accountType` (`PERSONAL`/`ORGANIZATION`) plus `accountId`                                                                                | The account is stored, not inferred. It mirrors the billing owner tuple, so one shape names "who this belongs to" in both contexts, and the migration can backfill without guessing.                         |
| Personal id    | `accountId` is the person's own id when the account is personal                                                                                             | An empty or null id would recreate the "no organization means personal" ambiguity at the column level.                                                                                                       |
| Member         | `userId` stays, and every read keeps it                                                                                                                     | The conversation belongs to a person _inside_ an account: an organization's threads are per member, never shared, so the account tuple is an additional filter, not a replacement.                           |
| Read context   | `conversationOwner` derives the person and account from the session, and every query composes one `conversationOwnerConditions` predicate                   | The account cannot be forgotten by a caller, because a read has no bare user id to filter by; one predicate means a new query cannot spell the scope differently from the others.                            |
| Reads          | Every read filters by the owner: the switcher, the thread, the history dialog, the live-turn lookup, the parked prompt, the retry target, the branch source | An id from another account's conversation must select nothing. Filtering in the query, not in the page, is what makes that true for every caller instead of the careful ones.                                |
| Latest         | The "latest conversation" fallback and the requested-id check both resolve inside the active account                                                        | Switching accounts must change the set. A named id belonging to the account the person just left is not theirs to open here, so it is replaced rather than answered.                                         |
| Writes         | `openDashboardPrompt` files the row under the owner and refuses a conversation filed elsewhere                                                              | The conversation row and its first prompt are created in one transaction, so the account the prompt is paid by and the account the thread is filed under are decided together.                               |
| Branches       | A branch inherits the source conversation's account                                                                                                         | A branch continues a thread; filing it elsewhere would silently move history into another account.                                                                                                           |
| Titles         | The title job is scoped to the owner and the account tuple                                                                                                  | A background write must not rename a conversation the person can no longer see, and the upsert is already conditional.                                                                                       |
| Allowance      | Unchanged: the paying account still comes from the session, checked once when a prompt is opened                                                            | The account partition decides visibility, not who pays. Retry, approval resume and branched copies keep their existing treatment.                                                                            |
| Migration      | Existing conversations become `PERSONAL` with `accountId = userId`                                                                                          | History was written before accounts were recorded, by people in their personal context; nothing moves between accounts, and a person who signs in after the deploy finds their threads where they left them. |

## Consequences

- Switching the active account switches the conversation set, and switching back
  restores the first one: the two lists are disjoint by construction.
- A teammate never sees another member's conversation, because `userId` is still
  part of every predicate; being in the same organization does not share history.
- A conversation id from another account resolves to nothing, so the URL cannot
  be used to read a thread the active account does not hold.
- Prompt ownership, the per-member allowance and the branch replay rule are
  untouched: this slice changes where a conversation lives, not what a prompt
  costs.

## Deferred

- Sharing a conversation with the account's other members.
- Moving a conversation between accounts.
- An organization-wide conversation list for owners and admins.
