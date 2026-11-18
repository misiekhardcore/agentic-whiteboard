/**
 * Adds two AI SDK usage objects leaf by leaf. An approval's continuation is
 * part of the same prompt, so its tokens are added to what the first step
 * already recorded instead of replacing them.
 */
export function addUsage(previous: unknown, next: unknown): unknown {
  if (typeof previous !== "object" || previous === null) return next ?? previous;
  if (typeof next !== "object" || next === null) return previous;

  const added: Record<string, unknown> = { ...(previous as Record<string, unknown>) };

  for (const [key, value] of Object.entries(next)) {
    const before = added[key];
    if (before === undefined) {
      added[key] = value;
    } else if (typeof before === "number" && typeof value === "number") {
      added[key] = before + value;
    } else if (typeof before === "object" && typeof value === "object") {
      added[key] = addUsage(before, value);
    }
  }

  return added;
}
