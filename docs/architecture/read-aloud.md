# Read agent replies aloud

Status: accepted
Date: 2026-11-15

## Context

The dashboard thread streams the agent's answer, but a person listening rather
than reading had no option: the browser's speech synthesis was unused, and the
composer only had voice **input** ([voice-input](voice-input.md)). Reading a
reply aloud from start to finish would be simple; reading it _as it streams_ is
not, because the text arrives in token-sized pieces. Handing each piece to the
synthesizer produces stuttering and repeated half-words, and waiting for the
whole answer throws away the point of streaming.

The feature also has to respect the context layout from
[module-boundaries](module-boundaries.md): the speaker rule is a client-safe
thread presenter (`lib/ai/thread`), while the stored preference belongs to the
`userSettings` row, which the `identity` context owns. A context may not query
another context's schema, so the AI thread reads no preference and identity
exposes the read and the mutation.

## Decisions

| Area              | Decision                                                                                              | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Synthesis         | The browser's `speechSynthesis`, on the client                                                        | No audio, key or server route is involved; the reply is already in the browser. Nothing to store and no new failure surface in the API.                                                                                                                                                                                                                                                                                                                       |
| Boundary rule     | Whole sentences and whole lines, from `pendingSpeech`                                                 | A sentence terminator followed by whitespace is safe; a newline covers headings, lists and table rows and can never fall inside a word. A slow stream waits instead of being fragmented, unlike a token/timer buffer.                                                                                                                                                                                                                                         |
| Not a boundary    | Terminators without trailing whitespace, decimals, common abbreviations and initials                  | "3.14", "e.g." and "Dr. Smith" must stay in one utterance. A wrong boundary that merges two sentences is the lesser defect, so the abbreviation list stays short and explicit.                                                                                                                                                                                                                                                                                |
| What is spoken    | Assistant prose only                                                                                  | The person's prompt, the agent's reasoning and its tool calls are not the answer. Reasoning is the model's working and is already hidden in the thread.                                                                                                                                                                                                                                                                                                       |
| Markdown          | Stripped to words; fenced code skipped whole                                                          | Hearing "asterisk asterisk" or "h t t p s colon slash slash" is noise. Code is not prose; a heading, list item or link keeps its text and loses its syntax.                                                                                                                                                                                                                                                                                                   |
| Offsets           | A per-message spoken offset, advanced only by consumed text                                           | Every stream chunk re-parses the reply, so the offset is what prevents saying the same words twice. It also lets the rule stay pure and directly testable.                                                                                                                                                                                                                                                                                                    |
| History           | Every message present at mount is marked spoken; only new replies are read                            | A reload must not start reading a stored conversation from the top. The composer passes the loaded thread, so the hook seeds offsets before the first stream.                                                                                                                                                                                                                                                                                                 |
| Enabling mid-turn | Starts at the next complete sentence                                                                  | Text already on screen was not heard and re-reading it would be surprising; the offsets advance while the preference is off.                                                                                                                                                                                                                                                                                                                                  |
| Preference home   | A `readAloud` column on `userSettings`, read through `PersonalSettings` in `lib/identity/settings.ts` | It is a personal accessibility preference, not an account setting: it follows the person to another device and is unaffected by which organization is active. Identity owns the row, so the dashboard and the capability compose its published functions. A dedicated settings table keeps the better-auth `user` row out of app preferences and gives later personal settings a home; a row is created on the first change, so an absent row is the default. |
| Read model        | `readPersonalSettings(userId)` returns every preference, defaulted for an absent row                  | The page and the composer take one query and read a field, so a second personal setting does not add a query or a second reader. Defaults exist once, in `DEFAULT_PERSONAL_SETTINGS`.                                                                                                                                                                                                                                                                         |
| Writes            | One writer per preference (`saveReadAloud`), not a partial update of the whole row                    | A `savePersonalSettings(patch)` would need merge semantics for the fields it was not given, and a stale form could overwrite a newer choice made on another surface.                                                                                                                                                                                                                                                                                          |
| Mutation          | The human-only `setReadAloud` capability, registered and exposed as `setReadAloudAction`              | Every user-facing mutation goes through the capability kernel; `callers: ["human"]` says the agent may not decide to speak for the person. The action is the usual thin wrapper, and the capability revalidates the dashboard.                                                                                                                                                                                                                                |
| Toggle            | Two controls, one capability: the composer's speaker and a switch under Settings → Preferences        | The speaker belongs where the speaking happens; the settings switch is where a person looks for a preference. Both write through `setReadAloudAction`, apply optimistically, and revert with an explanation when the save is refused.                                                                                                                                                                                                                         |
| Saving feedback   | The settings switch announces the confirmed choice (`Saved. Read aloud is on.`)                       | The optimistic switch can show a state the server has not stored yet, so the status names the value the server accepted rather than a bare "Saved" that a stale render could satisfy.                                                                                                                                                                                                                                                                         |
| Stopping          | Toggle-off, Stop prompt and unmount cancel the queue and mark the reply read                          | Speech outlives a component, and a stopped reply must not be spoken by the end-of-turn flush.                                                                                                                                                                                                                                                                                                                                                                 |
| Streaming         | The existing transport, made observable                                                               | The route already streams UI message parts; with a real provider its visible text arrives progressively. The scripted stub sent its whole answer as one delta, so it now streams a word per chunk and the e2e server spaces those chunks out.                                                                                                                                                                                                                 |
| Boundaries        | `useReadAloud` is the only module that touches `speechSynthesis`                                      | The API is absent on the server, so support is read through `useSyncExternalStore` and the hook runs in effects, never at module scope. The pure rule is listed as a client-safe module, so the boundary test holds it to that.                                                                                                                                                                                                                               |

## Flow

1. The dashboard loads the thread and the person's stored preference in
   parallel; `PromptComposer` mounts with both, and `useReadAloud` seeds every
   loaded message as already spoken.
2. The agent's reply streams in. On each update the hook takes the last
   assistant message's prose, joins its text parts and asks `pendingSpeech` for
   the sentences past its offset. Complete sentences go to
   `speechSynthesis.speak`, in order; the incomplete tail waits.
3. The end of the turn (`isBusy` false) flushes the tail, so a reply without a
   final period is still read. Fenced code never reaches the synthesizer.
4. Stop prompt, toggling the speaker off, or leaving the composer calls
   `cancel()`, which empties the browser queue and marks the reply as read.
5. The speaker button, or the switch on the settings page, flips the preference
   optimistically and calls `setReadAloudAction`, which runs the human-only
   capability: authenticate, validate, `saveReadAloud`, revalidate the
   dashboard. On refusal the control returns to the stored value and explains
   it — a toast in the composer, an inline alert in settings. The settings page
   then announces the confirmed choice, so a navigation cannot outrun the save.
6. Failure codes from the synthesizer are mapped by `speechErrorMessage` into
   the hint line under the field; the person's own Stop stays quiet.

## Consequences

- No text leaves the browser for this feature and no audio is stored. The
  browser vendor's voices do the speaking, so quality and available languages
  vary by platform.
- Browser autoplay policy can require a gesture before the first utterance. The
  toggle is that gesture in normal use; a deployment that resumes a stored
  preference and speaks without any interaction may be silent until the person
  touches the page. This is a browser rule, not something the app can override.
- A reasoning model streams reasoning before visible text, so read aloud begins
  when the answer starts, not when the model starts working. The composer's
  "The agent is drafting…" line covers that window.
- `speechSynthesis` is not available everywhere; the button stays visible,
  disabled, with the reason in its tooltip.
- The e2e suite installs a fake synthesizer, so it proves the chunking,
  persistence and stop behaviour but not the vendor voice. Listening to one real
  reply is still the only check of the audio itself.
- The preference is app-owned in `userSettings`, one row per person, read
  explicitly rather than through the session user. Writes upsert, so the first
  change creates the row and later ones update it without a read first.
- Settings are identity's because the row belongs to the person; the speaking
  rules stay in `ai`. The split is recorded in
  [module-boundaries](module-boundaries.md#why-settings-live-with-the-owner-not-with-the-feature)
  so the next personal preference lands in identity rather than a new context.

## Deferred

- Choosing a voice, rate or language per person.
- Per-surface scope (a workspace chat could have its own preference).
- On-device synthesis and non-English replies.
- Reading the prompt or tool results on request.
- Keyboard shortcut for the speaker, and pause/resume controls.
