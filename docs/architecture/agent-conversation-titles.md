# Generated conversation titles

Status: accepted
Date: 2026-11-17

Extends [agent-conversations](agent-conversations.md); the conversation, retry
and branch decisions there still hold.

## Context

A conversation has always been named by its first live prompt, cut to one line.
That is immediate and honest, but it is not a name: "make me a thing that does
the other thing" is the whole sentence the person typed, and a list of five of
them tells a reader very little. The model already runs for the conversation; a
short request of its own can turn the first prompt into a name.

The naming call must not become part of the turn. Sharing the agent's transcript
would make a label compete with the reply for steps and tokens, and awaiting it
before streaming would make every first prompt slower for a cosmetic gain.

## Decisions

| Area              | Decision                                                                           | Why                                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Storage           | `agentConversation.title`, nullable                                                | `null` is the only state needed for "not named yet"; the read path already has a derived label to fall back to, so there is no placeholder to store.                                                                                                                                                                                                               |
| Immediate label   | The first live prompt, exactly as before                                           | The pill must exist the moment the conversation does; a generated name is a replacement, not a prerequisite.                                                                                                                                                                                                                                                       |
| Model request     | A separate `generateText` call with title-only instructions                        | Naming is not a conversation turn: no tools, no transcript, a small output budget. It also keeps the stream and the name independent.                                                                                                                                                                                                                              |
| Answer format     | Exactly one `Title: <name>` line, and it is the only usable answer                 | The first message is quoted as material, not sent as a prompt, or the model answers it instead of naming it. An answer without the marker (a refusal, an explanation) is unusable, so the derived label stays.                                                                                                                                                     |
| Output budget     | 512 tokens                                                                         | A model that reasons before answering spends part of the budget on that reasoning; capped to the title alone it can return no text at all, and a title-shaped cap is exactly what made local reasoning models fail here.                                                                                                                                           |
| Source            | The first live user message of the conversation                                    | A later prompt continues a thread; naming it after the newest prompt would let every message rename the conversation.                                                                                                                                                                                                                                              |
| Trigger           | Every accepted new prompt, and every successful branch                             | A new prompt is the moment the conversation exists and its first message is stored. Re-scheduling on later prompts is the retry: the service skips when a title is already stored, so a provider outage costs one attempt.                                                                                                                                         |
| Timing            | `after()` from `next/server`                                                       | Next guarantees the request runs after the response. The name never delays the reply and never shares its abort signal.                                                                                                                                                                                                                                            |
| Retry             | Failed or empty output stores nothing; the next prompt tries again                 | A conversation with a missing name is not an error worth blocking on; the derived label stays readable in the meantime.                                                                                                                                                                                                                                            |
| Idempotence       | Conditional update on `title IS NULL`                                              | Two attempts — a retry, a branch, two tabs — can race; the first stored title wins and the later one observes it instead of overwriting.                                                                                                                                                                                                                           |
| Client update     | Poll the session-scoped title endpoint until a title exists or a bounded wait ends | The page render happens before the naming request finishes. The endpoint is scoped by the session like every other conversation read. The wait is bounded (90s, every 1.5s) because the naming request cannot report its own progress: it runs in the turn's route, so an in-process flag is not visible to the title read and looked abandoned on the first poll. |
| Scripted provider | The stub answers a title request with a `Stub title:` name                         | The e2e suite must be able to observe the swap without a model, and the prefix keeps a scripted demo visibly scripted.                                                                                                                                                                                                                                             |
| Allowance         | Not counted as a prompt                                                            | It is not a conversation turn and opens no `agentPrompt` row; counting it would charge a person for a label.                                                                                                                                                                                                                                                       |

## Flow

1. A new prompt is accepted and its user message stored.
2. `scheduleConversationTitle` registers the work with `after()`.
3. After the response the title service checks ownership and the stored title,
   reads the first live user message, asks the model for a `Title:` line,
   normalises it, and writes it conditionally.
4. The composer, which started watching after the turn, reads
   `/api/agent/conversations/[id]/title` until it carries a title. It stops on a
   title, on unmount, or after a bounded wait; a title swaps the pill in place.

## Consequences

- The switcher and history dialog show a real name once one exists; a reload
  reads it from the database, so it does not depend on the page that started it.
- A conversation created before this change has no title until its next prompt
  (or a branch copy) schedules one. The derived label remains valid meanwhile.
- Each new prompt on an untitled conversation costs one model call until a title
  is stored.
- A branch is named from the first prompt copied into it, not from the reply it
  branched at, because that prompt is what the branch starts with.

## Deferred

- Renaming a conversation by hand.
- Backfilling titles for existing conversations that are never prompted again.
- Reporting naming progress across processes: the watch polls for the stored
  title for a bounded time instead, which costs a cheap read while it waits.
- Retrying a refused title request without another prompt.
