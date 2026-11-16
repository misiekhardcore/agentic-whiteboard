import { Suspense } from "react";

import { Loading } from "@/components/Loading/Loading";
import { loadDashboardPromptThread } from "@/lib/ai/thread/store";
import { getSessionAccount } from "@/lib/identity/account";
import { readPersonalSettings } from "@/lib/identity/settings";

import { PromptComposer } from "./PromptComposer";

/**
 * The composer is a client component with the thread as its initial messages, so
 * it must mount once, with the real thread. Wrapping the read in `<Suspense>`
 * keeps the page prerenderable: the shell streams in and the composer appears
 * when the stored conversation has loaded.
 */
export function PromptSection() {
  return (
    <Suspense fallback={<Loading className="py-16" />}>
      <PromptSectionInner />
    </Suspense>
  );
}

async function PromptSectionInner() {
  const account = await getSessionAccount();
  if (!account) {
    return (
      <PromptComposer initialMessages={[]} initialReadAloud={false} initialReadAloudVoice="" />
    );
  }

  const userId = account.session.user.id;
  const [messages, settings] = await Promise.all([
    loadDashboardPromptThread(userId),
    readPersonalSettings(userId),
  ]);

  return (
    <PromptComposer
      initialMessages={messages}
      initialReadAloud={settings.readAloud}
      initialReadAloudVoice={settings.readAloudVoice}
    />
  );
}
