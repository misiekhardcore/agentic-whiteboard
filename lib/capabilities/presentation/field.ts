/** Reads a field from a tool input the thread only knows as `unknown`. */
export function field(input: unknown, key: string): unknown {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)[key]
    : undefined;
}
