import { normalizeOrganizationSlug } from "./normalizeOrganizationSlug";

/**
 * A slug that will not collide with an existing organization. Better Auth
 * requires uniqueness and offers no retry, so a random suffix is the cheap way
 * to keep "Orbit" and a second "Orbit" distinct.
 */
export function uniqueOrganizationSlug(value: string): string {
  return `${normalizeOrganizationSlug(value) || "org"}-${crypto.randomUUID().slice(0, 8)}`;
}
