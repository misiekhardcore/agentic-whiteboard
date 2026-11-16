# Dashboard conversations, retry and rewind

Status: accepted
Date: 2026-11-16

Supersedes the "one conversation per person" consequences of
[agent-prompt-thread](agent-prompt-thread.md); the turn, approval and liveness
decisions there still hold.

## Context

The dashboard had exactly one conversation per person, and no name for it. It
was an emergent fact of the schema: every prompt with `workspaceId = null`
belonged to a person's thread, and the page replayed the newest 40 messages
across all of them, so "the conversation" was whatever came last. Three
consequences followed.

- There was no way to start over. A person who wanted a fresh thread had to
  keep talking into the old one, so every new task arrived with the previous
  task's history in the model's context.
- A failed turn could only be recovered by retyping the prompt, which is a
  second prompt — a second charge, and chat pollution: the request appears twice
  with an error between them.
- Editing an earlier instruction was impossible. It is the most common thing a
  person wants to do to a plan ("do it with Postgres, not SQLite"), and the only
  affordance was to say it again further down and hope the model re-reads.

The thread was also a plain `<ol>` in the document flow, so a long conversation
pushed the composer off the page and made the whole dashboard one endless
column.

## Decisions

| Area             | Decision                                                                      | Why                                                                                                                                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversation     | A first-class `agentConversation` row, owned by a user                        | A thread that owns its prompts can be listed, switched and started without inventing an ordering over an undifferentiated prompt table.                                                                                                                                         |
| Identity         | The id is chosen before the first prompt (a UUID in the URL)                  | "New conversation" is a navigation, not a write: opening one and leaving it costs nothing, and there is no empty row to clean up. The first accepted prompt creates the row.                                                                                                    |
| Legacy data      | A `legacy-<userId>` conversation per person, backfilled by the migration      | Existing history must stay one thread, and a person who deploys this finds their conversation where they left it rather than an empty dashboard.                                                                                                                                |
| Prompt ownership | `agentPrompt.conversationId`; null remains only for workspace and legacy rows | The prompt is the billing unit and the execution unit, so the thread is read through it rather than through a second join table.                                                                                                                                                |
| Superseding      | `supersededAt` on the prompt and on the message, never a delete               | The allowance counts prompts that ran. A discarded turn still happened and still counts, so it is marked rather than removed; the thread and the model only ever see the live turns.                                                                                            |
| Retry            | Re-run the newest prompt when it is `FAILED` and the text did not change      | The person paid for that prompt and got nothing back; charging again for the same words would be charging for the outage. Only the tip qualifies — a prompt with turns after it is not an error to recover, it is a branch.                                                     |
| Rewind           | An edited prompt is a new prompt; everything at or after it is superseded     | The work that runs is new work, so it is counted like any prompt. The branch point is a position, not a list index, because a re-edit resends an id that an earlier edit already superseded.                                                                                    |
| Intent           | The server derives it from the stored message, not from a client flag         | A `retry: true` field from the browser would be a way to run prompts for free. The stored prompt's status and text decide, and the client only says which message it is sending.                                                                                                |
| Message ids      | An append keeps the browser's message id; a rewind mints one                  | The composer names an edit by the message the person sees. Keeping the id on an append is what makes the prompt just sent editable; a rewind replaces a stored row, so it needs a fresh id.                                                                                     |
| Allowance        | Checked only where a new prompt is opened                                     | A retry reuses its row, and an approval answer continues one; both are already counted, so neither can be refused for being out of allowance halfway through work the person paid for.                                                                                          |
| Switching        | The open conversation is `?conversation=<id>`, and the section is keyed by it | `useChat` takes its messages once. A remount with the chosen thread's messages is the honest way to switch, and it keeps the URL shareable and reload-safe. The key uses the URL's id, not the resolved one, so a first visit does not remount and abort the prompt being sent. |
| Switcher         | The five most recently updated conversations, labelled by their first prompt  | Enough to go back to what was just left without becoming a sidebar. A conversation with no live prompt is not listed, because there is nothing in it to open.                                                                                                                   |
| Scroll           | The thread is its own scroll box with a maximum height, pinned to the newest  | The composer must stay in place while a reply arrives. Following is a property of the position, not of the render: content growing does not move the scroll position, so only an upward scroll stops it, and the observer resumes as soon as the reader returns to the bottom.  |
| Retry control    | Offered by the composer and by the thread when the stored tip failed          | The browser knows a send failed before it reached the route (the outage never wrote a row); the page knows the stored prompt failed. Both offer the same one-click retry, and both send the same message again.                                                                 |

### Why a conversation is URL state

The alternative is a `POST /api/agent/conversations` from a button. It creates a
row for a thread nobody has written in, and the person who clicks "New" and then
navigates away leaves an empty conversation in their switcher forever. A UUID in
the URL needs no write, survives a reload, works with the back button, and the
route already has to decide which conversation a prompt belongs to — it now
reads that decision from the request instead of guessing "the newest one".

The row is created by `openDashboardPrompt`, in the same transaction that accepts
the prompt, so a conversation exists exactly when it has something in it.

### Why a retry is free but a rewind is not

Both send a stored message again, and telling them apart is a rule, not a UI
detail — so it lives in `promptIntent`:

- **Retry** — the target is the conversation's newest live prompt, its status is
  `FAILED`, and the text is unchanged. The person asked for this once, it broke,
  and the same words are being run again. The row is reused: `retryFailedPrompt`
  moves it back to `RUNNING`, its usage accrues, and no new prompt is counted.
- **Rewind** — everything else. A changed text is a new instruction and runs new
  work; a successful prompt is deliberately re-run; a prompt with turns after it
  discards those turns. Each is a new prompt and is counted.

A failed attempt's partial reply stays in the database with
`agentMessage.supersededAt` set instead of being deleted: the turn reads as one
prompt with one answer, while the operator can still see what the broken stream
produced. Because the retry reuses the prompt row, the failed reply and the new
one are siblings under it.

Reusing a row is a conditional write, not a read followed by a write: the retry
swaps `FAILED` → `RUNNING` in one statement, and an answered approval does the
same to the prompt it parked. When the single-flight index fires anyway — a
second tab retrying the same prompt, or a send that took the slot while an
approval sat unanswered — the loser is answered with a 409 naming the busy
thread and the row is left exactly as it was found. Losing that race is never a
500 and never a prompt stuck in `RUNNING`.

### Why the composer names messages instead of prompts

`useChat.setMessages` truncates the browser's list at a message and
`sendMessage({ text, messageId })` replaces that message and drops the rest —
which is exactly an edit. So the composer only ever needs to say "this message",
and the route resolves it through `findUserPromptTarget`, which looks the id up
inside the conversation the session owns. A message id from another account's
conversation resolves to nothing, and the send becomes a plain append.

## Flow

1. The dashboard reads `?conversation=`. A stored id the session owns is used; an
   id nobody owns is replaced by the person's most recent conversation; no id
   means the most recent conversation, or a fresh UUID on the first visit.
2. The section loads that conversation's live thread (superseded prompts and
   messages filtered out), whether its tip failed, the five recent conversations
   and the person's reading preference, then mounts the composer with them.
3. "New conversation" navigates to a fresh UUID. Nothing is written.
4. Sending posts the UI thread, the conversation id and the newest message. The
   route resolves the account, validates the newest user message against the
   provider config, and resolves the submitter's stored prompt by message id.
   The posted thread is a mirror, not the model's input: the turn reads the
   conversation's live turns back from the store (up to and including the prompt
   it just recorded), so a body that carries a discarded branch or an invented
   reply is answered exactly like a clean one. The only things a body
   contributes are the prompt being sent and, for a parked approval, the
   answer — which is matched to the stored request before the turn resumes.
5. `promptIntent` decides append, retry or rewind. A retry reuses its row; an
   append checks the allowance and opens a counted prompt; a rewind checks the
   allowance, supersedes every live prompt from the branch point and opens a new
   one. The conversation row is created on first use.
6. The stream is unchanged from
   [agent-prompt-thread](agent-prompt-thread.md#flow): tools run with the actor,
   the reply is stored, usage is recorded, the row is closed.

## Consequences

- A person can hold several conversations and switch between the recent ones; a
  conversation with nothing live in it is not offered, so the switcher never grows
  junk.
- The monthly count is a count of work, not of visible turns: superseded prompts
  keep counting, and only a retry of a failed tip is free.
- History is never destroyed by an edit. The database keeps every discarded turn
  and its messages; only the thread and the model look away.
- A page reload replays the live thread, so an abandoned edit branch cannot come
  back. A second tab that still holds one cannot replay it either: what the model
  is shown is read from the stored turns, not from the browser.
- The conversation list is per person, not per account: switching the active
  account does not hide a conversation, and the allowance still follows the
  account that ran each prompt.
- The thread box scrolls instead of the page, and stops following while the
  reader is scrolled up.

## Deferred

- A full conversation sidebar (rename, delete, search).
- Sharing a conversation with the account's other members.
- Restoring a superseded branch.
- Streaming the same conversation to several tabs.
