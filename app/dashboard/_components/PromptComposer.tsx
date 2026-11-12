"use client";

import { Button } from "@konopskidev/ui/components/button";
import { Textarea } from "@konopskidev/ui/components/textarea";
import { ArrowUp } from "lucide-react";
import {
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  composerKeyIntent,
  EXAMPLE_PROMPTS,
  submittedPrompt,
} from "@/lib/ai/prompt-composer";

type PromptComposerProps = {
  /**
   * Receives the trimmed prompt when the user sends it. The agent run is not
   * wired yet, so the dashboard omits it today; this is the seam the run flow
   * will connect to.
   */
  onSubmit?: (prompt: string) => void;
};

/**
 * The dashboard's starting point for an agent session: a prompt box that sends
 * on Enter, keeps Shift+Enter for line breaks, and offers curated examples that
 * fill the field so they stay editable before sending.
 */
export function PromptComposer({ onSubmit }: PromptComposerProps) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const promptToSend = submittedPrompt(draft);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!promptToSend) return;
    onSubmit?.(promptToSend);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const intent = composerKeyIntent({
      key: event.key,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
    });

    // A bare Enter sends through the form so the button and the keyboard share
    // one path; every other key keeps the textarea's native behaviour.
    if (intent !== "submit") return;

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function applyExample(prompt: string) {
    setDraft(prompt);
    textareaRef.current?.focus();
  }

  return (
    <section
      aria-labelledby="prompt-composer-title"
      className="topo-bg px-2 py-10 sm:py-14"
    >
      <div className="mx-auto max-w-5xl flex w-full flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1
            id="prompt-composer-title"
            className="page-title text-balance sm:text-display"
          >
            What are we planning today?
          </h1>
          <p className="text-lead text-pretty text-muted-foreground">
            Describe it, and the agent drafts the doc and the canvas for you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="card flex flex-col p-1.5">
            <Textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Prompt"
              aria-describedby="prompt-composer-hint"
              placeholder="e.g. Design the database for a food delivery app and document it"
              className="min-h-28 resize-none border-0 bg-transparent px-2.5 py-2"
            />

            <div className="flex items-center justify-between gap-3 px-1.5">
              <p
                id="prompt-composer-hint"
                className="text-xs text-muted-foreground"
              >
                Shift + Enter for a new line
              </p>
              <Button
                type="submit"
                variant="primary"
                size="icon-lg"
                className="rounded-full shadow"
                aria-label="Send prompt"
                disabled={!promptToSend}
              >
                <ArrowUp />
              </Button>
            </div>
          </div>

          <ul aria-label="Example prompts" className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <li key={prompt}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto rounded-full py-1.5 text-left"
                  onClick={() => applyExample(prompt)}
                >
                  {prompt}
                </Button>
              </li>
            ))}
          </ul>
        </form>
      </div>
    </section>
  );
}
