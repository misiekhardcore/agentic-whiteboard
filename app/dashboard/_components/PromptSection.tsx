import { Suspense } from "react";

import { PromptComposer } from "@/components/Composer/PromptComposer";
import { Loading } from "@/components/Loading/Loading";
import {
  listConversations,
  loadConversationThread,
  RECENT_CONVERSATION_LIMIT,
  resolveActiveConversation,
} from "@/lib/ai/thread/conversations";
import { getSessionAccount } from "@/lib/identity/account";
import { readPersonalSettings } from "@/lib/identity/settings";

/**
 * The composer is a client component with the thread as its initial messages, so
 * it must mount once, with the real thread. Wrapping the read in `<Suspense>`
 * keeps the page prerenderable: the shell streams in and the composer appears
 * when the stored conversation has loaded.
 *
 * The composer is keyed by the conversation: switching threads is a remount with
 * that thread's messages, not a prop change a live `useChat` would ignore.
 */
export function PromptSection({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  return (
    <Suspense fallback={<Loading className="py-16" />}>
      <PromptSectionInner searchParams={searchParams} />
    </Suspense>
  );
}

async function PromptSectionInner({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  const { conversation } = await searchParams;
  const requestedConversation = Array.isArray(conversation) ? conversation[0] : conversation;

  const account = await getSessionAccount();
  if (!account) {
    return (
      <PromptComposer
        initialConversationId={crypto.randomUUID()}
        initialMessages={[]}
        initialCanRetry={false}
        initialConversations={[]}
        initialReadAloud={false}
        initialReadAloudVoice=""
      />
    );
  }

  const userId = account.session.user.id;
  const conversationId = await resolveActiveConversation({
    userId,
    requested: requestedConversation,
  });
  const [thread, conversations, settings] = await Promise.all([
    loadConversationThread({ userId, conversationId }),
    listConversations(userId, RECENT_CONVERSATION_LIMIT),
    readPersonalSettings(userId),
  ]);

  // The key is the URL's conversation, not the resolved one: a first visit has
  // no stored conversation yet, and a freshly generated id would change under
  // the composer on every server refresh — remounting it and aborting the prompt
  // being sent. "latest" keeps that thread until the person picks another one.
  return (
    <PromptComposer
      key={requestedConversation ?? "latest"}
      initialConversationId={conversationId}
      initialMessages={thread.messages}
      initialCanRetry={thread.canRetry}
      initialConversations={conversations}
      initialReadAloud={settings.readAloud}
      initialReadAloudVoice={settings.readAloudVoice}
    />
  );
}
