export function quoted(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? `“${value.trim()}”` : null;
}
