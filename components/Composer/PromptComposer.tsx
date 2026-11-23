"use client";

import { Button } from "@konopskidev/ui/components/button";
import { Textarea } from "@konopskidev/ui/components/textarea";
import type { UIMessage } from "ai";
import { ArrowUp, RotateCcw, Square } from "lucide-react";
import { useRef } from "react";

import { IconButton } from "@/components/Thread/IconButton";
import { PromptThread } from "@/components/Thread/PromptThread";
import { DictationButton } from "@/components/Voice/DictationButton";
import { ReadAloudButton } from "@/components/Voice/ReadAloudButton";
import { type DashboardConversation, lastUserMessage } from "@/lib/ai/thread/rules";

import { ComposerHeader } from "./ComposerHeader";
import { ExamplePrompts } from "./ExamplePrompts";
import { PromptFailureAlert } from "./PromptFailureAlert";
import { QueuedPrompts } from "./QueuedPrompts";
import { usePromptComposer } from "./usePromptComposer";

/**
 * An agent session: the conversation, the composer field and the status around
 * it. The behaviour lives in `usePromptComposer`; this component only lays them
 * out. The surface that mounts it supplies the heading, the width and the
 * padding, so the dashboard and the panel share one composer.
 */
export function PromptComposer({
  initialConversationId,
  initialMessages,
  initialCanRetry,
  initialConversations,
  initialReadAloud,
  initialReadAloudVoice,
}: {
  initialConversationId: string;
  initialMessages: UIMessage[];
  initialCanRetry: boolean;
  initialConversations: DashboardConversation[];
  initialReadAloud: boolean;
  initialReadAloudVoice: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composer = usePromptComposer({
    fieldRef: textareaRef,
    initialConversationId,
    initialMessages,
    initialCanRetry,
    initialReadAloud,
    initialReadAloudVoice,
  });
  const lastMessage = composer.messages[composer.messages.length - 1];
  const retryable = lastUserMessage(composer.messages);

  return (
    <section aria-label="Agent composer" className="flex flex-col gap-6">
      <ComposerHeader
        conversations={initialConversations}
        conversationId={composer.conversationId}
        isBusy={composer.isBusy}
        onNewConversation={composer.startNewConversation}
      />

      <PromptThread
        messages={composer.messages}
        isDrafting={composer.awaitingText}
        branchingId={composer.branching}
        onBranch={composer.isBusy ? undefined : composer.branchFrom}
        onEdit={composer.isBusy ? undefined : composer.editPrompt}
        onRegenerate={composer.isBusy ? undefined : composer.retryLastPrompt}
        editingId={composer.editing?.messageId ?? null}
        onRead={composer.speech.supported ? composer.speech.readMessage : undefined}
        onStop={composer.speech.supported ? composer.speech.cancel : undefined}
        speakingId={composer.speech.speakingId}
        streamingId={composer.isBusy ? lastMessage?.id : null}
        onApproval={(approvalId, approved) => {
          composer.addToolApprovalResponse({ id: approvalId, approved });
        }}
      />

      {composer.canRetry && !composer.failure && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            The last prompt did not finish. Retrying it does not use another prompt.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={composer.retryLastPrompt}
            disabled={composer.isBusy || !retryable}
          >
            <RotateCcw />
            Retry
          </Button>
        </div>
      )}

      <form onSubmit={composer.handleSubmit} className="flex flex-col gap-3">
        <QueuedPrompts
          messages={composer.queuedMessages}
          onRemove={composer.experimental_removeQueuedMessage}
        />

        {composer.editing && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted px-3 py-2 text-xs">
            <span>
              Editing an earlier prompt. Sending replaces it and everything the agent answered after
              it.
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={composer.cancelEdit}>
              Cancel
            </Button>
          </div>
        )}

        <div className="flex flex-col card p-1.5">
          <Textarea
            ref={textareaRef}
            value={composer.fieldValue}
            onChange={(event) => composer.setDraft(event.target.value)}
            onKeyDown={composer.handleKeyDown}
            readOnly={composer.dictation.isListening}
            aria-label="Prompt"
            aria-describedby="prompt-composer-hint"
            placeholder="e.g. Design the database for a food delivery app and document it"
            className="min-h-28 resize-none border-0 bg-transparent px-2.5 py-2"
          />

          <div className="flex items-center justify-between gap-3 px-1.5">
            <p
              id="prompt-composer-hint"
              aria-live="polite"
              className="text-xs text-muted-foreground"
            >
              {composer.hint}
            </p>
            <div className="flex items-center gap-2">
              <DictationButton
                supported={composer.dictation.supported}
                isListening={composer.dictation.isListening}
                describedBy="prompt-composer-hint"
                onToggle={composer.dictation.toggle}
              />
              <ReadAloudButton
                supported={composer.speech.supported}
                enabled={composer.readAloud}
                isSpeaking={composer.speech.isSpeaking}
                onToggle={composer.toggleReadAloud}
              />
              {composer.isBusy && (
                <IconButton
                  label="Stop prompt"
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  className="rounded-full shadow"
                  onClick={() => {
                    composer.speech.cancel();
                    void composer.stop();
                  }}
                >
                  <Square />
                </IconButton>
              )}
              <IconButton
                label={composer.isBusy ? "Queue prompt" : "Send prompt"}
                type="submit"
                variant="primary"
                size="icon-lg"
                className="rounded-full shadow"
                disabled={!composer.promptToSend}
              >
                <ArrowUp />
              </IconButton>
            </div>
          </div>
        </div>

        {composer.failure && (
          <PromptFailureAlert
            failure={composer.failure}
            isBusy={composer.isBusy}
            onRetry={composer.retryLastPrompt}
          />
        )}

        <ExamplePrompts onPick={composer.applyExample} />
      </form>
    </section>
  );
}
