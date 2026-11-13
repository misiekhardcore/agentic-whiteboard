import { Loading } from "@/components/Loading/Loading";
import { getSessionAccount } from "@/lib/account";
import { loadDashboardPromptThread } from "@/lib/ai/prompts";
import { Suspense } from "react";

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
  if (!account) return <PromptComposer initialMessages={[]} />;

  return (
    <PromptComposer
      initialMessages={await loadDashboardPromptThread(account.session.user.id)}
    />
  );
}
