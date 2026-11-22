import { type ComponentProps, Suspense } from "react";

import { PromptComposer } from "@/components/Composer/PromptComposer";
import { Loading } from "@/components/Loading/Loading";
import { loadConversationSet } from "@/lib/ai/thread/conversations";
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
/**
 * The dashboard's own surface around the shared composer: the page hero and the
 * centred column belong to the dashboard, not to the composer the panel mounts.
 */
function DashboardComposer(props: ComponentProps<typeof PromptComposer>) {
  return (
    <div className="topo-bg px-2 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 id="prompt-composer-title" className="page-title text-balance sm:text-display">
            What are we planning today?
          </h1>
          <p className="text-lead text-pretty text-muted-foreground">
            Describe it, and the agent drafts the doc and the canvas for you.
          </p>
        </div>
        <PromptComposer {...props} />
      </div>
    </div>
  );
}

export function ComposerSection({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  return (
    <Suspense fallback={<Loading className="py-16" />}>
      <ComposerSectionInner searchParams={searchParams} />
    </Suspense>
  );
}

async function ComposerSectionInner({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  const { conversation } = await searchParams;
  const requestedConversation = Array.isArray(conversation) ? conversation[0] : conversation;

  const account = await getSessionAccount();
  if (!account) {
    return (
      <DashboardComposer
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
  // The composer shows this person's threads in the account they are acting as;
  // switching accounts is a different owner and therefore a different set.
  const owner = { userId, organizationId: account.activeOrganizationId };
  // The panel reads this same set, so the dashboard and the workspaces section
  // cannot drift into two answers for "which conversation is open".
  const [conversationSet, settings] = await Promise.all([
    loadConversationSet({ owner, requested: requestedConversation }),
    readPersonalSettings(userId),
  ]);

  // The key is the URL's conversation, not the resolved one: a first visit has
  // no stored conversation yet, and a freshly generated id would change under
  // the composer on every server refresh — remounting it and aborting the prompt
  // being sent. "latest" keeps that thread until the person picks another one.
  return (
    <DashboardComposer
      key={requestedConversation ?? "latest"}
      initialConversationId={conversationSet.conversationId}
      initialMessages={conversationSet.messages}
      initialCanRetry={conversationSet.canRetry}
      initialConversations={conversationSet.conversations}
      initialReadAloud={settings.readAloud}
      initialReadAloudVoice={settings.readAloudVoice}
    />
  );
}
