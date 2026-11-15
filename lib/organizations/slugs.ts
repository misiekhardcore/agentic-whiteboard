/**
 * The organization slug rule, once.
 *
 * The team form, the profile form and checkout all derive a slug from a name,
 * and the first two let a person edit it. They must agree on what is valid, so
 * the normalization lives here instead of in each action.
 */

export const ORGANIZATION_SLUG_MAX_LENGTH = 40;

/** Lowercase letters, digits and single hyphens; empty when nothing survives. */
export function normalizeOrganizationSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, ORGANIZATION_SLUG_MAX_LENGTH);
}

/**
 * A slug that will not collide with an existing organization. Better Auth
 * requires uniqueness and offers no retry, so a random suffix is the cheap way
 * to keep "Orbit" and a second "Orbit" distinct.
 */
export function uniqueOrganizationSlug(value: string): string {
  return `${normalizeOrganizationSlug(value) || "org"}-${crypto.randomUUID().slice(0, 8)}`;
}
