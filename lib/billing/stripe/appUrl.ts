/** Absolute origin for redirect and return URLs. */
export function appUrl(): string {
  const url = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return url.replace(/\/$/, "");
}
