/** A configured value, or nothing when it is absent or only whitespace. */
export function readValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
