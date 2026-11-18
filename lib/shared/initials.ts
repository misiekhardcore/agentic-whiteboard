/** The one-letter fallback an avatar shows when there is no image. */
export function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}
