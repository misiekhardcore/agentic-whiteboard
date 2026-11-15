# Voice input for the prompt composer

Status: accepted
Date: 2026-11-15

## Context

The dashboard composer is the app's starting point for an agent session, and
typing a long prompt is the slowest part of it. The browser can already turn
speech into text: the Web Speech API exposes `SpeechRecognition` in Chromium
browsers and, as `webkitSpeechRecognition`, in Safari. The composer needed an
answer to how dictated words join a draft that may already contain text, how a
session that fails is explained, and where the recognition runs.

The composer's existing split applies: the rules live in
[lib/ai/thread/composer.ts](../../lib/ai/thread/composer.ts) as pure functions,
and the component maps browser events onto them.

## Decisions

| Area             | Decision                                                                                | Why                                                                                                                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recognition      | The browser's Web Speech API, on the client                                             | The browser recognizes speech against its vendor's service; no audio, key or server route is involved, so there is nothing to store and no new failure surface in the API.                                                                              |
| Where words go   | Splice at the caret the microphone captured, with one separating space                  | The person may be editing mid-sentence; replacing the draft or always appending would throw work away. The pure rule is `withTranscript`.                                                                                                               |
| Interim results  | The session previews the phrase still in flight, then replaces it                       | Live feedback during a long pause matters, and a preview that is replaced by its final text can never duplicate words. `dictationTranscript` joins finals with the interim phrase.                                                                      |
| Ending a session | Commit as editable text; never send                                                     | Dictation is input, not submission. The person corrects the words and presses Enter themselves. A prompt sent mid-session keeps what was already heard.                                                                                                 |
| Unsupported      | The microphone stays visible, disabled, with the reason in the hint line                | A missing button reads as a broken app. Chromium and Safari have the API, Firefox does not, and the composer says so where the keyboard hint normally sits.                                                                                             |
| Failures         | `dictationErrorMessage` maps the browser's code to one sentence                         | Permission refusal, no microphone, silence and an unreachable service each need different advice; `aborted` (the person stopped) says nothing.                                                                                                          |
| Language         | Fixed `en-US`                                                                           | The composer's copy is English. Following the browser locale mixed languages in a draft without the person asking for it; a picker is deferred until there is a settings surface for it.                                                                |
| Typing           | The field is read-only while dictating                                                  | Recognition owns the value until the session ends; accepting keystrokes that the next result overwrites is worse than briefly not accepting them.                                                                                                       |
| Boundaries       | `useDictation` is the only module that touches `SpeechRecognition`                      | The API is absent on the server and in other browsers, so support is read through `useSyncExternalStore` and the instance is created in an effect, never at module scope.                                                                               |
| Composition      | `useDictation` owns the session and the field value; `DictationButton` owns the control | The composer keeps only its draft and layout: the hook captures the draft and caret, splices the words, commits them and restores the caret, and the button owns its toggle attributes and tooltip. Both are reusable if another field gains dictation. |

## Flow

1. The person clicks the microphone. `useDictation.toggle()` captures the draft
   and the textarea's selection from the field ref, and starts a session with
   `lang = "en-US"`, `continuous` and `interimResults`.
2. Each `onresult` batch appends finished phrases and replaces the interim
   phrase. The composer renders the hook's `value`, which is
   `withTranscript(capturedDraft, capturedSelection, transcript)`, so a phrase
   that becomes final is not added twice.
3. On Stop, on silence or on an error the session ends. The hook commits the
   transcript through the same rule, focuses the field and puts the caret after
   the words. `discard()` ends a session without inserting anything, which is what
   a send or a chosen example needs.
4. An error appears in the hint line under the field, which the textarea and the
   microphone already point at with `aria-describedby`; the next session clears
   it.
5. Enter or Send while a session is open stops it first, so the words heard so
   far are part of the prompt. Otherwise the composer behaves exactly as before.

## Consequences

- No server, database, billing or capability changes: the feature is client-only.
- `types/web-speech.d.ts` declares the small slice of the API TypeScript's
  `lib.dom` omits. It is deliberately narrow; widen it only when the hook needs
  more.
- Audio is processed by the browser vendor's speech service. Chrome sends it to
  Google, Safari to Apple; this application never receives it. Some deployments
  (enterprise policy, offline, no microphone) therefore cannot dictate, which the
  hint explains.
- Firefox has no implementation. The disabled button is the expected state there,
  not a defect.
- Playwright cannot exercise a real recognizer, so
  [e2e/voice-input.spec.ts](../../e2e/voice-input.spec.ts) installs a fake
  `SpeechRecognition` and feeds results the way Chrome does. Manual verification
  with a microphone is still the only check of the browser's own recognition.

## Deferred

- Choosing the dictation language per person or per account.
- Hold-to-talk and a keyboard shortcut for the microphone.
- Dictation in the workspace dialogs and other text fields.
- Voice commands such as "send it".
- On-device recognition (`processLocally`) for browsers that support it.
