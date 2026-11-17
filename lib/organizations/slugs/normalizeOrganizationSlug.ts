import { ORGANIZATION_SLUG_MAX_LENGTH } from "./ORGANIZATION_SLUG_MAX_LENGTH";

/** Lowercase letters, digits and single hyphens; empty when nothing survives. */
export function normalizeOrganizationSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, ORGANIZATION_SLUG_MAX_LENGTH);
}
