/**
 * Which prompts this process is streaming for each person's dashboard thread.
 *
 * The one-active-per-thread index is the single-flight rule, but a prompt row
 * outlives the request that wrote it: a server restarted mid-stream leaves it
 * QUEUED or RUNNING forever, and the next send then collides with a prompt
 * nothing is working on. The row's status cannot tell a live stream from an
 * orphan, and no timestamp can either — a slow model may hold the first token for
 * minutes. This registry can, because only the process that started a stream
 * holds it.
 *
 * One prompt per thread is expected, but a continuation (an approval) can start
 * before the previous stream has cleaned up, so the value is a set.
 *
 * The state is in-process, which is exact while the app runs as one server per
 * environment — the deployment it has today. Running more than one instance
 * would need the lease written down in the database instead; see
 * [docs/architecture/agent-prompt-thread.md](../../../docs/architecture/agent-prompt-thread.md).
 */
const streaming = new Map<string, Set<string>>();

export function markThreadStream(userId: string, promptId: string): void {
  const prompts = streaming.get(userId) ?? new Set<string>();
  prompts.add(promptId);
  streaming.set(userId, prompts);
}

export function clearThreadStream(userId: string, promptId: string): void {
  const prompts = streaming.get(userId);
  if (!prompts) return;

  prompts.delete(promptId);
  if (prompts.size === 0) streaming.delete(userId);
}

/** The prompts this process is streaming for the person, in mark order. */
export function streamingPromptIds(userId: string): string[] {
  return [...(streaming.get(userId) ?? [])];
}
