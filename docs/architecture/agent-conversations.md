# Dashboard conversations, retry and rewind

Status: accepted
Date: 2026-11-16

> **Superseded.** Retry, rewind and branch are checkpoint operations on an
> `agentThread`, not copied prompt and message rows; the table and the rules in
> this record are replaced by [agent-architecture](../agent-architecture.md).
> The product requirements it captured still hold.

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
| Switcher         | The five most recently updated conversations, labelled by their stored title  | Enough to go back to what was just left without becoming a sidebar. A conversation with no live prompt is not listed, because there is nothing in it to open.                                                                                                                   |
| Title            | Derived from the first prompt, then replaced once by a generated one          | The pill exists the moment a prompt is accepted, so the switcher never waits for a model. Naming is cheap work on a cheap endpoint, done in the background and published as a change; a failure leaves the derived title in place.                                              |
| Title ownership  | `agentConversation.title` and `titleGeneratedAt`, written once                | Reading the label used to mean reading the first live prompt on every list call. The column is what the switcher reads, and `titleGeneratedAt` is what makes "generated once" a condition on the write rather than a convention.                                                |
| History          | Every conversation, listed in a dialog beside the pills, read when it opens   | The pills can only name the last few; the rest need a way in that is not a sidebar. Reading on open keeps a dashboard visit from fetching a whole history, and a bounded limit keeps the query from growing without end.                                                        |
| Scroll           | The thread is its own scroll box with a maximum height, pinned to the newest  | The composer must stay in place while a reply arrives. Following is a property of the position, not of the render: content growing does not move the scroll position, so only an upward scroll stops it, and the observer resumes as soon as the reader returns to the bottom.  |
| Retry control    | Offered by the composer and by the thread when the stored tip failed          | The browser knows a send failed before it reached the route (the outage never wrote a row); the page knows the stored prompt failed. Both offer the same one-click retry, and both send the same message again.                                                                 |
| Branch           | A new conversation holding a copy of the live turns through a reply           | "Carry on from here, without the rest" is a second thread, and a prompt belongs to one conversation — so the turns are copied rather than shared. Editing a copied turn rewinds the branch and leaves the original alone.                                                       |
| Branch origin    | `agentPrompt.branchedFromId` marks a copy, and the count skips it             | The copy is history: the turn ran, and was paid for, where it came from. Counting it again would charge a person for branching, which does no work. Marking it says so in the row rather than in a query's shape.                                                               |
| Branch point     | Only a turn that finished can be copied                                       | A queued, running or parked turn is not history yet, and a copy of a parked approval could never be answered: the parked row, and the single-flight slot it reopens, belong to the original conversation.                                                                       |
| Message actions  | Per message, revealed on hover; always visible where nothing can hover        | A long thread should read as a conversation, not as a wall of buttons. Copy and edit belong to the prompt; copy, read aloud, re-run (newest only) and branch belong to the reply. Re-running an older reply is not offered — that is what editing its prompt is for.            |
| Icon buttons     | One label per button, used as its accessible name and its tooltip             | An icon is the whole control, so its meaning has to be on screen somewhere. One string cannot disagree with itself the way an `aria-label` and a tooltip written separately can, and it keeps the icon legible to a screen reader and a pointer alike.                          |

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

### Why a branch copies instead of sharing

A branch could have pointed the new conversation at the old one's prompts, and
saved a write. It would make one prompt belong to two conversations, which the
schema, the single-flight rule and every read in `conversations.ts` assume is not
true: an edit in the branch would have to decide whether it also changed the
original. Copying keeps the invariant and gives the branch its own life; the
original is untouched and still counts what it ran.

The copy keeps source order by giving each copied row a later timestamp than the
one before it, because the ids are freshly generated and two source turns stored
in the same millisecond would otherwise be separated by an id tie-break. Copied
prompts are recorded as `COMPLETED` whatever the source ended as: history cannot
take the single-flight slot, and it must not offer a free retry for a turn the
person already paid for in the conversation it came from.

### Why a title is generated rather than only derived

A label cut from the prompt is honest and immediate, but it is the person's
wording, not a name: "plan the schema for the invoicing tables and also" is what
the pill shows after a long paste. A model asked for one short line does that
work better, and the answer arrives while the person is reading the reply they
asked for.

So the order is derived first, generated second, and never blocking. The
conversation row is created with the derived title in the same transaction as
its first prompt; `refineConversationTitle` then runs unawaited, reads the newest
prompts, asks the title endpoint (its own `TITLE_AI_*` configuration, which may
be a different server from the agent's), cleans the answer and writes it only
while `titleGeneratedAt` is still null. It publishes `conversations` as a change,
which is how an open page shows the new name without a reload. A fork starts
with no prompts, so its first prompt is the new turn that triggers the same job.

### Why the composer names messages instead of prompts

`useChat.setMessages` truncates the browser's list at a message and
`sendMessage({ text, messageId })` replaces that message and drops the rest —
which is exactly an edit. So the composer only ever needs to say "this message",
and the route resolves it through `findUserPromptTarget`, which looks the id up
inside the conversation the session owns. A message id from another account's
conversation resolves to nothing, and the send becomes a plain append.

### Where it lives

Persisting a thread is one concern per file, so a change to a retry, a rewind or
an approval lands in exactly one of them:

- `rules.ts` — the pure rules: append/retry/rewind intent, the branch and
  history windows, the stored-message mapping.
- `lib/ai/titles` — the derived title, the generated one, the request and its
  cleaning, and the background write that names a conversation once.
- `conversations.ts` — reads: which conversation is open, its live thread, one
  turn's history, and one list read that serves both the pills and the history
  dialog.
- `prompts.ts` — the prompt row's life: open (an append or a rewind's new
  branch), retry, resume after an approval, close, and the usage it accrues.
  The single-flight loss is mapped here, as `busy` or `expired`.
- `branches.ts` — copying a conversation's finished turns into a new one, and
  the refusal when the chosen turn has not finished.
- `allowance.ts` — the monthly count and the refusal copy; the one place that
  knows a branch's replay is not an execution.
- `messages.ts` — the message rows: the person's text before the stream, the
  agent's reply after it, and which stored prompt a repeated message names.
- `orphans.ts` — which active prompts nothing is streaming, and retiring them
  before the next send takes the slot.
- `live.ts` — the in-process registry of streams that answers "is anything
  streaming this prompt?".
- `turn.ts` — one dashboard turn: who pays, the allowance, the recording, the
  stream.
- `capabilities.ts` / `actions.ts` — the thread's one operation that is not a
  prompt (branching), declared as a human-only capability and exposed as the
  action the browser calls.

The direction is one-way: `rules.ts` imports no database, no reader imports a
writer, and `turn.ts` is the only module that composes the others.

## Flow

1. The dashboard reads `?conversation=`. A stored id the session owns in the
   active account is used; an id nobody owns (or that belongs to another
   account) is replaced by the person's most recent conversation there; no id
   means that most recent conversation, or a fresh UUID on the first visit.
2. The section loads that conversation's live thread (superseded prompts and
   messages filtered out), whether its tip failed, the five recent conversations
   and the person's reading preference, then mounts the composer with them.
3. "New conversation" navigates to a fresh UUID. Nothing is written.
4. Branching sends the reply's message id to the branch action. The server copies
   that conversation's live turns through the reply into a new conversation, in
   one transaction, marking each copy as a replay; the browser then opens it.
5. Sending posts the UI thread, the conversation id and the newest message. The
   route resolves the account, validates the newest user message against the
   provider config, and resolves the submitter's stored prompt by message id.
   The posted thread is a mirror, not the model's input: the turn reads the
   conversation's live turns back from the database (up to and including the prompt
   it just recorded), so a body that carries a discarded branch or an invented
   reply is answered exactly like a clean one. An approval answer is the
   exception: it streams the posted thread, because the decision and the turn it
   belongs to already exist in the browser, and each tool call in it is
   authorized again by `invoke` when it runs.
6. `promptIntent` decides append, retry or rewind. A retry reuses its row; an
   append checks the allowance and opens a counted prompt; a rewind checks the
   allowance, supersedes every live prompt from the branch point and opens a new
   one. The conversation row is created on first use.
7. The stream is unchanged from
   [agent-prompt-thread](agent-prompt-thread.md#flow): tools run with the actor,
   the reply is stored, usage is recorded, the row is closed.

## Consequences

- A person can hold several conversations, switch between the recent ones, or
  open any of them from the history dialog; a conversation with nothing live in
  it is not offered, so neither list ever grows junk.
- The monthly count is a count of work, not of visible turns: superseded prompts
  keep counting, and only a retry of a failed tip is free.
- History is never destroyed by an edit. The database keeps every discarded turn
  and its messages; only the thread and the model look away.
- A page reload replays the live thread, so an abandoned edit branch cannot come
  back. A second tab that still holds one cannot replay it either: what the model
  is shown is read from the stored turns, not from the browser.
- The conversation list is per person and per account; this consequence was
  superseded by [conversation-accounts](conversation-accounts.md). The allowance
  still follows the account that ran each prompt.
- The thread box scrolls instead of the page, and stops following while the
  reader is scrolled up.
- Branching costs nothing and loses nothing: the copy is not counted, and the
  conversation it came from keeps its turns and stays usable.

## Deferred

- Renaming a conversation by hand, deleting or searching conversations: the
  history dialog lists them, it does not manage them, and a title is only ever
  what the prompt and the model said.
- Sharing a conversation with the account's other members.
- Restoring a superseded branch.
- Streaming the same conversation to several tabs.
