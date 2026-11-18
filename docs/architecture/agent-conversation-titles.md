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

| Area              | Decision                                                                    | Why                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage           | `agentConversation.title`, nullable                                         | `null` is the only state needed for "not named yet"; the read path already has a derived label to fall back to, so there is no placeholder to store.                                                                                                                                                                                                      |
| Immediate label   | The first live prompt, exactly as before                                    | The pill must exist the moment the conversation does; a generated name is a replacement, not a prerequisite.                                                                                                                                                                                                                                              |
| Model request     | A separate `generateText` call with title-only instructions                 | Naming is not a conversation turn: no tools, no transcript, a small output budget. It also keeps the stream and the name independent.                                                                                                                                                                                                                     |
| Answer format     | Exactly one `Title: <name>` line, and it is the only usable answer          | The first message is quoted as material, not sent as a prompt, or the model answers it instead of naming it. An answer without the marker (a refusal, an explanation) is unusable, so the derived label stays.                                                                                                                                            |
| Output budget     | 64 tokens                                                                   | A title is six words, and reasoning is off, so the answer is all the model can spend this on. The budget is not what makes a model answer - `reasoning_effort: "none"` is - and keeping it small keeps the request cheap.                                                                                                                                 |
| Source            | The first live user message of the conversation                             | A later prompt continues a thread; naming it after the newest prompt would let every message rename the conversation.                                                                                                                                                                                                                                     |
| Trigger           | Every accepted new prompt, and every successful branch                      | A new prompt is the moment the conversation exists and its first message is stored. Re-scheduling on later prompts is the retry: the service skips when a title is already stored, so a provider outage costs one attempt.                                                                                                                                |
| Timing            | Started with the turn, kept alive by `after()` from `next/server`           | The name is generated alongside the reply rather than after it, so it is ready while the person is still reading. `after()` only holds the response's process open until the promise settles, so the turn never awaits a label and never shares its abort signal.                                                                                         |
| Retry             | Failed or empty output stores nothing; the next prompt tries again          | A conversation with a missing name is not an error worth blocking on; the derived label stays readable in the meantime.                                                                                                                                                                                                                                   |
| Idempotence       | Conditional update on `title IS NULL`                                       | Two attempts — a retry, a branch, two tabs — can race; the first stored title wins and the later one observes it instead of overwriting.                                                                                                                                                                                                                  |
| Client update     | None: the stored title is read by the next render of the page               | A title arrives after the render that started it, and a background request cannot push to an open page. Rather than poll for it or refresh the route from the client, the label is a server fact like every other: the next load shows it. Live renaming is deferred until the app has one deliberate update channel.                                     |
| Model choice      | Its own endpoint: `AI_TITLE_BASE_URL`, `AI_TITLE_API_KEY`, `AI_TITLE_MODEL` | A local reasoning model spends the request on deliberation before naming, and a hosted small model answers for a few thousandths of a cent. Naming is a six-word label, so it is the one place a different endpoint earns its keep. There is no fallback to the agent's model: a deployment states where names come from, like every other model setting. |
| Reasoning         | The naming request is sent `reasoning_effort: "none"`                       | A name must arrive quickly and answer, not reason. It is sent only for naming, never for the agent: an endpoint that serves both would otherwise reason less on the turns that need it.                                                                                                                                                                   |
| Retries           | Naming is not retried; the next prompt reschedules                          | Naming is best effort and already retried by every accepted prompt. Retrying inside the turn that triggered a name would spend the turn's time on a label.                                                                                                                                                                                                |
| Scripted provider | The stub answers a title request with a `Stub title:` name                  | The e2e suite must be able to observe a stored title without a model, and the prefix keeps a scripted demo visibly scripted.                                                                                                                                                                                                                              |
| Allowance         | Not counted as a prompt                                                     | It is not a conversation turn and opens no `agentPrompt` row; counting it would charge a person for a label.                                                                                                                                                                                                                                              |

## Flow

1. A new prompt is accepted and its user message stored. The pill and the
   thread show the first prompt cut to one line, so a label exists immediately.
2. `startConversationTitle` begins the naming request at that moment, in
   parallel with the turn, and hands the same promise to `after()`.
3. The title service checks ownership and the stored title, reads the first live
   user message, asks the model for a `Title:` line, normalises it, and writes it
   conditionally. This usually finishes while the reply is still streaming.
4. The page keeps the label it rendered. The next load of the dashboard, the
   switcher or the history dialog reads the stored title and shows it.

## Consequences

- The switcher and history dialog show a real name once one exists. It is read
  from the database on each render, so it does not depend on the page that
  started the request.
- A conversation created before this change has no title until its next prompt
  (or a branch copy) schedules one. The derived label remains valid meanwhile.
- Each new prompt on an untitled conversation costs one model call until a title
  is stored.
- A branch is named from the first prompt copied into it, not from the reply it
  branched at, because that prompt is what the branch starts with.

## Configuration

```
AI_TITLE_BASE_URL="https://api.groq.com/openai/v1"
AI_TITLE_API_KEY="…"
AI_TITLE_MODEL="qwen/qwen3.8-27b"
```

All three are required and none of them falls back to the agent's settings: the
app has no built-in provider list and no defaults, so the common local setup -
agent on LM Studio, names on Groq - is a complete endpoint rather than a
provider name plus a model id.

## Deferred

- Renaming a conversation by hand.
- Backfilling titles for existing conversations that are never prompted again.
- Retrying a refused title request without another prompt.
- Showing a new title on the page that started it: that needs an update channel
  the whole app shares, not a per-composer read.
